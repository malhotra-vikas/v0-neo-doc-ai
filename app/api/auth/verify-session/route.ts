import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getFirebaseAdmin } from '@/lib/firebase/admin'

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const sessionCookie = cookieStore.get('session')?.value

        if (!sessionCookie) {
            return NextResponse.json({ isValid: false }, { status: 401 })
        }

        const auth = getFirebaseAdmin()
        await auth.verifySessionCookie(sessionCookie, true)
        
        return NextResponse.json({ isValid: true })
    } catch (error) {
        console.error('Session verification error:', error)
        return NextResponse.json({ isValid: false }, { status: 401 })
    }
}
