import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/server/auth'

export async function GET(req: NextRequest) {
    try {
        const userData = await getServerUser()
        
        if (!userData) {
            return NextResponse.json({ error: 'No authenticated user' }, { status: 401 })
        }

        return NextResponse.json(userData)
    } catch (error) {
        console.error('User data fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }
}
