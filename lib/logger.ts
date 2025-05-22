/**
 * Enhanced logging utility for debugging
 */
export const logger = {
    info: (component: string, message: string, data?: any) => {
        const timestamp = new Date().toISOString()
        const logMessage = `[${timestamp}] [INFO] [${component}] ${message}`

        if (data) {
            console.log(logMessage, data)
        } else {
            console.log(logMessage)
        }
    },

    error: (component: string, message: string, error?: any) => {
        const timestamp = new Date().toISOString()
        const logMessage = `[${timestamp}] [ERROR] [${component}] ${message}`

        if (error) {
            console.error(logMessage, error)
        } else {
            console.error(logMessage)
        }
    },

    debug: (component: string, message: string, data?: any) => {
        const timestamp = new Date().toISOString()
        const logMessage = `[${timestamp}] [DEBUG] [${component}] ${message}`

        if (data) {
            console.log(logMessage, data)
        } else {
            console.log(logMessage)
        }
    },

    timing: (component: string, operation: string) => {
        const start = performance.now()
        return {
            end: () => {
                const duration = performance.now() - start
                console.log(`[${new Date().toISOString()}] [TIMING] [${component}] ${operation}: ${duration.toFixed(2)}ms`)
                return duration
            }
        }
    }
}
