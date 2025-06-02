import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export class StorageService {
  private supabase = createClientComponentClient()
  private FACILITY_LOGOS_BUCKET = 'facility-logos'
  private DOCUMENTS_BUCKET = 'documents'

  async uploadFacilityLogo(filePath: string, file: File) {
    return await this.supabase.storage
      .from(this.FACILITY_LOGOS_BUCKET)
      .upload(filePath, file)
  }

  async getFacilityLogoUrl(path: string | null) {
    if (!path) return null

    const { data } = this.supabase.storage
      .from(this.FACILITY_LOGOS_BUCKET)
      .getPublicUrl(path)

    return data.publicUrl
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