const RATES = [8000,16000,24000,32000,44100,48000]

export class Pcm24kStream {
  private carry: number | null = null
  private samples: number[] = []
  private base = 0
  private total = 0
  private outputIndex = 0
  private finished = false
  private readonly taps: number[]
  private readonly history = new Float64Array(63)
  private cursor = 0
  constructor(private readonly rate: number) {
    if (!RATES.includes(rate)) throw new Error('Fish: sample rate non supportato.')
    // Causal windowed-sinc anti-alias filter; delay is <2 ms at supported downsample rates.
    const cutoff = 0.45 * Math.min(1, 24000 / rate)
    this.taps = rate > 24000 ? Array.from({length:63},(_,i)=>{
      const x=i-31
      return (x === 0 ? 2*cutoff : Math.sin(2*Math.PI*cutoff*x)/(Math.PI*x)) * (0.54-0.46*Math.cos(2*Math.PI*i/62))
    }) : []
    const sum=this.taps.reduce((a,b)=>a+b,0)
    this.taps=this.taps.map(t=>t/sum)
  }
  push(bytes: Uint8Array): Uint8Array {
    if (this.finished) throw new Error('Fish: stream PCM gia terminato.')
    for (const byte of bytes) {
      if (this.carry === null) {this.carry=byte;continue}
      const word=this.carry | (byte << 8), sample=word>=32768 ? word-65536 : word
      this.carry=null
      let filtered=sample
      if (this.taps.length) {
        this.history[this.cursor]=sample; filtered=0
        for(let i=0;i<this.taps.length;i++) filtered+=this.taps[i]*this.history[(this.cursor-i+63)%63]
        this.cursor=(this.cursor+1)%63
      }
      this.samples.push(filtered);this.total++
    }
    return this.emit(false)
  }
  finish(): Uint8Array {
    if (this.carry !== null) throw new Error('Fish: campione PCM incompleto.')
    if (this.finished) throw new Error('Fish: stream PCM gia terminato.')
    this.finished=true
    return this.emit(true)
  }
  private emit(final: boolean): Uint8Array {
    const result: number[]=[]
    const count=Math.floor(this.total*24000/this.rate)
    while(this.outputIndex<count) {
      const position=this.outputIndex*this.rate/24000, left=Math.floor(position), fraction=position-left
      if (!final && left+1>=this.total) break
      const a=this.samples[left-this.base], b=this.samples[Math.min(left+1,this.total-1)-this.base]
      result.push(Math.max(-32768,Math.min(32767,Math.round(a+(b-a)*fraction))))
      this.outputIndex++
    }
    const keep=Math.min(this.total-1,Math.floor(this.outputIndex*this.rate/24000))
    if (keep>this.base) {this.samples.splice(0,keep-this.base);this.base=keep}
    const bytes=new Uint8Array(result.length*2), view=new DataView(bytes.buffer)
    result.forEach((sample,index)=>view.setInt16(index*2,sample,true))
    return bytes
  }
}
