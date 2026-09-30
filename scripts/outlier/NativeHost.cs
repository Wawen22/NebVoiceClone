using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Windows.Automation;

public class NativeHost {
    const int Limit = 1048576;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = Limit };
    static readonly object PipeLock = new object(), OutputLock = new object(), JsonLock = new object();
    static Stream Pipe, Output;
    static volatile bool Connected = true;
    static IntPtr AssociatedWindow = IntPtr.Zero;
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public INPUTUNION data; }
    [StructLayout(LayoutKind.Explicit)] struct INPUTUNION {
        [FieldOffset(0)] public KEYBDINPUT keyboard;
        [FieldOffset(0)] public MOUSEINPUT mouse;
    }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort vk, scan; public uint flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int x, y; public uint mouseData, flags, time; public IntPtr extra; }
    [DllImport("user32.dll")] static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle, out uint process);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int size);
    static IntPtr EdgeWindow() {
        IntPtr hwnd = GetAncestor(GetForegroundWindow(), 3); uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        if (hwnd == IntPtr.Zero || Process.GetProcessById((int)pid).ProcessName != "msedge") throw new InvalidOperationException("Collega la scheda mentre Edge è in primo piano.");
        return hwnd;
    }
    static string Serialize(object value) { lock (JsonLock) return Json.Serialize(value); }
    static Dictionary<string, object> Parse(string value) { lock (JsonLock) return Json.Deserialize<Dictionary<string, object>>(value); }
    static byte[] ReadExactly(Stream stream, int length) {
        byte[] bytes = new byte[length]; int offset = 0;
        while (offset < length) { int read = stream.Read(bytes, offset, length - offset); if (read == 0) throw new EndOfStreamException(); offset += read; }
        return bytes;
    }
    static Dictionary<string, object> ReadFrame(Stream stream) {
        uint length = BitConverter.ToUInt32(ReadExactly(stream, 4), 0);
        if (length == 0 || length > Limit) throw new InvalidDataException("Invalid frame.");
        return Parse(new UTF8Encoding(false, true).GetString(ReadExactly(stream, (int)length)));
    }
    static void WriteFrame(Stream stream, object gate, object value) {
        byte[] bytes = Encoding.UTF8.GetBytes(Serialize(value));
        if (bytes.Length > Limit) throw new InvalidDataException("Invalid frame.");
        lock (gate) { stream.Write(BitConverter.GetBytes((uint)bytes.Length), 0, 4); stream.Write(bytes, 0, bytes.Length); stream.Flush(); }
    }
    static string Text(AutomationElement element) {
        object pattern;
        if (!element.TryGetCurrentPattern(ValuePattern.Pattern, out pattern)) throw new InvalidOperationException("Il campo non espone un valore verificabile a Windows.");
        ValuePattern value = (ValuePattern)pattern;
        if (value.Current.IsReadOnly) throw new InvalidOperationException("Il controllo è di sola lettura.");
        return value.Current.Value.Replace("\r\n", "\n").Replace("\r", "\n");
    }
    static Dictionary<string, object> Probe(string expected) {
        IntPtr hwnd = EdgeWindow(); uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        if (AssociatedWindow == IntPtr.Zero || hwnd != AssociatedWindow) throw new InvalidOperationException("La finestra Edge non è quella associata.");
        AutomationElement element = AutomationElement.FocusedElement;
        if (element == null || element.Current.ControlType != ControlType.Edit || !element.Current.IsEnabled || !element.Current.HasKeyboardFocus || element.Current.ProcessId != (int)pid) throw new InvalidOperationException("Il focus Windows non è su un campo modificabile di Edge.");
        if (Text(element) != expected) throw new InvalidOperationException("Il testo del controllo Windows non corrisponde al Rationale atteso (lunghezze " + Text(element).Length + "/" + expected.Length + ").");
        foreach (int key in new int[] { 16, 17, 18, 91, 92 }) if ((GetAsyncKeyState(key) & 0x8000) != 0) throw new InvalidOperationException("Rilascia Shift, Ctrl, Alt e Windows prima di scrivere.");
        return new Dictionary<string, object> { { "hwnd", hwnd.ToInt64().ToString() }, { "controlId", String.Join(",", element.GetRuntimeId()) } };
    }
    static object Native(Dictionary<string, object> message) {
        if (!Connected || DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() > Convert.ToInt64(message["deadline"])) throw new InvalidOperationException("Richiesta scaduta o scollegata.");
        var payload = (Dictionary<string, object>)message["payload"];
        string action = (string)message["action"];
        if (action == "activate") {
            if (AssociatedWindow == IntPtr.Zero || !SetForegroundWindow(AssociatedWindow)) throw new InvalidOperationException("Windows non permette di attivare la finestra associata. Porta Edge in primo piano e riprova.");
            return new Dictionary<string, object> { { "activated", true } };
        }
        var actual = Probe((string)payload["expected"]);
        if (action == "probe") return actual;
        if (action != "type") throw new InvalidOperationException("Operazione non disponibile.");
        var lease = (Dictionary<string, object>)payload["lease"];
        if ((string)lease["hwnd"] != (string)actual["hwnd"] || (string)lease["controlId"] != (string)actual["controlId"]) throw new InvalidOperationException("Finestra o campo Windows cambiato.");
        string text = (string)payload["text"];
        if (text.Length == 0 || text.Length > 2 || (text.Length == 2 && !Char.IsSurrogatePair(text, 0)) || (text.Length == 1 && Char.IsSurrogate(text[0]))) throw new InvalidOperationException("Carattere non valido.");
        INPUT[] keys = new INPUT[text.Length * 2];
        for (int i = 0; i < text.Length; i++) {
            bool newline = text[i] == '\n';
            keys[i * 2] = new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { vk = newline ? (ushort)13 : (ushort)0, scan = newline ? (ushort)0 : text[i], flags = newline ? 0u : 4u } } };
            keys[i * 2 + 1] = keys[i * 2];
            keys[i * 2 + 1].data.keyboard.flags |= 2u;
        }
        // Probe again immediately before injection. One scalar is the maximum in-flight unit.
        var final = Probe((string)payload["expected"]);
        if ((string)final["hwnd"] != (string)actual["hwnd"] || (string)final["controlId"] != (string)actual["controlId"] || !Connected || DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() > Convert.ToInt64(message["deadline"])) throw new InvalidOperationException("Focus cambiato o richiesta scaduta.");
        string typo = payload.ContainsKey("typo") ? (payload["typo"] as string) : null;
        if (!String.IsNullOrEmpty(typo)) {
            INPUT[] typoKeys = new INPUT[typo.Length * 2];
            for (int i = 0; i < typo.Length; i++) {
                typoKeys[i * 2] = new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { vk = 0, scan = typo[i], flags = 4u } } };
                typoKeys[i * 2 + 1] = typoKeys[i * 2];
                typoKeys[i * 2 + 1].data.keyboard.flags |= 2u;
            }
            if (SendInput((uint)typoKeys.Length, typoKeys, Marshal.SizeOf(typeof(INPUT))) == typoKeys.Length) {
                var rng = new Random();
                Thread.Sleep(rng.Next(140, 221));
                INPUT[] bs = new INPUT[2];
                bs[0] = new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { vk = 8, scan = 0, flags = 0u } } };
                bs[1] = bs[0];
                bs[1].data.keyboard.flags |= 2u;
                SendInput((uint)bs.Length, bs, Marshal.SizeOf(typeof(INPUT)));
                Thread.Sleep(rng.Next(50, 91));
            }
        }
        if (SendInput((uint)keys.Length, keys, Marshal.SizeOf(typeof(INPUT))) != keys.Length) throw new InvalidOperationException("Windows non ha accettato tutti gli eventi. Nessuna ripetizione automatica.");
        return new Dictionary<string, object> { { "accepted", true } };
    }
    [STAThread] public static int Main(string[] args) {
        try {
            if (args.Length == 2 && args[0] == "--grant") {
                uint hostPid;
                if (!UInt32.TryParse(args[1], out hostPid) || Process.GetProcessById((int)hostPid).ProcessName != "NEBOutlierHost") return 1;
                return AllowSetForegroundWindow(hostPid) ? 0 : 1;
            }
            string directory = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
            var config = Parse(File.ReadAllText(Path.Combine(directory, "connection.json"), Encoding.UTF8));
            if (args.Length < 1 || args[0] != (string)config["origin"]) return 1;
            var client = new NamedPipeClientStream(".", (string)config["pipeName"], PipeDirection.InOut, PipeOptions.Asynchronous);
            client.Connect(3000); Pipe = client; Output = Console.OpenStandardOutput();
            WriteFrame(Pipe, PipeLock, new { kind = "hello", version = 1, token = (string)config["token"], origin = args[0], processId = Process.GetCurrentProcess().Id });
            var input = Console.OpenStandardInput();
            var browserReader = new Thread(() => {
                try {
                    while (Connected) {
                        var packet = ReadFrame(input);
                        string kind = packet.ContainsKey("kind") ? (string)packet["kind"] : "";
                        if (kind == "associated") {
                            var destination = (Dictionary<string, object>)packet["target"];
                            IntPtr hwnd = EdgeWindow();
                            var title = new StringBuilder(1024); GetWindowText(hwnd, title, title.Capacity);
                            string expectedTitle = (string)destination["title"];
                            if (!title.ToString().StartsWith(expectedTitle, StringComparison.Ordinal)) throw new InvalidOperationException("La finestra visibile non corrisponde alla scheda scelta.");
                            AssociatedWindow = hwnd;
                        }
                        if (kind == "associated" || kind == "invalidated" || kind == "reply") WriteFrame(Pipe, PipeLock, packet);
                    }
                } catch { Connected = false; Pipe.Close(); }
            });
            browserReader.IsBackground = true; browserReader.Start();
            while (Connected) {
                var message = ReadFrame(Pipe);
                if ((string)message["kind"] == "browser") { WriteFrame(Output, OutputLock, message); continue; }
                if ((string)message["kind"] != "native") throw new InvalidDataException();
                var reply = new Dictionary<string, object> { { "kind", "reply" }, { "requestId", message["requestId"] } };
                try { reply["result"] = Native(message); }
                catch (Exception error) { reply["error"] = error.Message; }
                WriteFrame(Pipe, PipeLock, reply);
            }
            return 0;
        } catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
        finally { Connected = false; if (Pipe != null) Pipe.Dispose(); }
    }
}
