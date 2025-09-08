import { createCanvas } from "canvas"

export class NodeCanvasFactory {
    create(width: number, height: number) {
        if (width <= 0 || height <= 0) {
            throw new Error("Invalid canvas size")
        }
        const canvas = createCanvas(width, height)
        const context = canvas.getContext("2d")
        return { canvas, context }
    }

    reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number) {
        if (width <= 0 || height <= 0) {
            throw new Error("Invalid canvas size")
        }
        canvasAndContext.canvas.width = width
        canvasAndContext.canvas.height = height
    }

    destroy(canvasAndContext: { canvas: any; context: any }) {
        canvasAndContext.canvas.width = 0
        canvasAndContext.canvas.height = 0
        canvasAndContext.canvas = null
        canvasAndContext.context = null
    }
}
