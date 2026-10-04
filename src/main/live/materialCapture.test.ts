import { afterEach, expect, it, vi } from 'vitest'
import type { NativeImage } from 'electron'

const fake = vi.hoisted(() => ({ getSources: vi.fn(), read: vi.fn(), createFromBuffer: vi.fn() }))
vi.mock('electron', () => ({ desktopCapturer: { getSources: fake.getSources }, clipboard: { read: fake.read }, nativeImage: { createFromBuffer: fake.createFromBuffer } }))
import { captureLiveSource, getLiveCaptureSources, importLiveImage, readLiveClipboardImage } from './materialCapture'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC', 'base64')
function image(width = 1920, height = 1080, empty = false): NativeImage {
  return { isEmpty: () => empty, getSize: () => ({ width, height }), toPNG: () => png, toDataURL: () => 'data:image/png;base64,' + png.toString('base64'), resize: vi.fn(() => image(2200, 1238)) } as unknown as NativeImage
}
afterEach(() => vi.clearAllMocks())

it('captures only the requested source at a readable resolution and handles closed windows', async () => {
  fake.getSources.mockResolvedValue([{ id: 'window:5:0', name: 'Coding interview', thumbnail: image() }])
  expect(await captureLiveSource('window:5:0')).toMatchObject({ name: 'Coding interview', dataUrl: expect.stringContaining('data:image/png') })
  expect(fake.getSources).toHaveBeenCalledWith(expect.objectContaining({ types: ['window'], thumbnailSize: { width: 2200, height: 1600 } }))
  await expect(captureLiveSource('window:6:0')).rejects.toThrow('non è più disponibile')
  await expect(captureLiveSource('file:///secret')).rejects.toThrow('Seleziona')
})

it('lists lightweight previews and skips unavailable captures', async () => {
  fake.getSources.mockResolvedValue([{ id: 'window:5:0', name: 'Interview', thumbnail: image() }, { id: 'window:6:0', name: 'Closed', thumbnail: image(1, 1, true) }])
  expect(await getLiveCaptureSources()).toHaveLength(1)
  expect(fake.getSources).toHaveBeenCalledWith(expect.objectContaining({ thumbnailSize: { width: 280, height: 160 } }))
})

it('normalizes copied/imported images and rejects empty or unsupported clipboard/file data', async () => {
  const large = image(3840, 2160)
  fake.read.mockResolvedValue([{ types: ['image/png'], getType: async () => new Blob([png]) }])
  fake.createFromBuffer.mockReturnValue(large)
  expect((await readLiveClipboardImage()).name).toContain('appunti')
  expect(large.resize).toHaveBeenCalledWith(expect.objectContaining({ width: 2200 }))
  fake.createFromBuffer.mockReturnValue(image())
  expect(importLiveImage(png, 'Code.png').name).toBe('Code.png')
  expect(() => importLiveImage(new Uint8Array([0, 1]), 'not.png')).toThrow('PNG o JPEG')
  fake.read.mockResolvedValue([])
  await expect(readLiveClipboardImage()).rejects.toThrow('Nessuno screenshot')
})
