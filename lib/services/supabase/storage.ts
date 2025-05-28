import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export class StorageService {
  private supabase = createServerComponentClient({ cookies })
  private FACILITY_LOGOS_BUCKET = 'facility-logos'
  private DOCUMENTS_BUCKET = 'documents'

  async uploadFacilityLogo(facilityId: string, file: File) {
    const path = `${facilityId}/${file.name}`
    return await this.supabase.storage
      .from(this.FACILITY_LOGOS_BUCKET)
      .upload(path, file)
  }

  async getFacilityLogo(path: string) {
    return await this.supabase.storage
      .from(this.FACILITY_LOGOS_BUCKET)
      .download(path)
  }

  async uploadDocument(facilityId: string, file: File) {
    const path = `${facilityId}/${file.name}`
    return await this.supabase.storage
      .from(this.DOCUMENTS_BUCKET)
      .upload(path, file)
  }

  async deleteFile(bucket: string, path: string) {
    return await this.supabase.storage
      .from(bucket)
      .remove([path])
  }
}