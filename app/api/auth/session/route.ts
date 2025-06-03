import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getFirebaseAdmin } from '@/lib/firebase/admin'

const EXPIRES_IN = 60 * 60 * 24 * 5 * 1000 
export async function POST(req: NextRequest) {
    try {
        const { idToken } = await req.json()
        
        const auth = getFirebaseAdmin()
        const sessionCookie = await auth.createSessionCookie(idToken, {
            expiresIn: EXPIRES_IN
        })

        const response = NextResponse.json({ success: true })
        
        response.cookies.set('session', sessionCookie, {
            maxAge: EXPIRES_IN / 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        })

        return response
    } catch (error) {
        console.error('Session creation error:', error)
        return NextResponse.json(
            { error: 'Unauthorized request' },
            { status: 401 }
        )
    }
}

export async function DELETE() {
    // Add await here too
    const cookieStore = await cookies()
    cookieStore.delete('session')
    return NextResponse.json({ success: true })
}