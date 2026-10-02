export interface ReadyLine {
  id: string
  text: string
  done: boolean
}

export type ReadyLinesTab = 'modelA' | 'modelB'

export function nextReadyLine(lines: ReadyLine[]): ReadyLine | undefined {
  return lines.find((line) => !line.done)
}

export function completeReadyLine(lines: ReadyLine[], id: string): ReadyLine[] {
  return lines.map((line) => line.id === id ? { ...line, done: true } : line)
}

export function createReadyLinesFromTexts(
  texts: string[],
  idGenerator: () => string = () => crypto.randomUUID()
): ReadyLine[] {
  return texts
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({
      id: idGenerator(),
      text,
      done: false
    }))
}

export function addReadyLine(lines: ReadyLine[], text: string, id: string): ReadyLine[] {
  return text.trim() ? [...lines, { id, text, done: false }] : lines
}

export function toggleReadyLineDone(lines: ReadyLine[], id: string): ReadyLine[] {
  return lines.map((line) => line.id === id ? { ...line, done: !line.done } : line)
}

export function editReadyLine(lines: ReadyLine[], id: string, text: string): ReadyLine[] {
  return text.trim() ? lines.map((line) => line.id === id ? { ...line, text } : line) : lines
}

export function moveReadyLine(lines: ReadyLine[], id: string, direction: -1 | 1): ReadyLine[] {
  const index = lines.findIndex((line) => line.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= lines.length) return lines
  const reordered = [...lines]
  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
  return reordered
}

export function removeReadyLine(lines: ReadyLine[], id: string): ReadyLine[] {
  return lines.filter((line) => line.id !== id)
}

export function restoreReadyLine(lines: ReadyLine[], line: ReadyLine, index: number): ReadyLine[] {
  if (lines.some((item) => item.id === line.id)) return lines
  const restored = [...lines]
  restored.splice(index, 0, line)
  return restored
}
