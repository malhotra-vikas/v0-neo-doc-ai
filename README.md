# NeoDocAi - Nursing Home Management System

NeoDocAi is a comprehensive nursing home management system designed to streamline the administration of nursing homes, patient records, and document management. The platform provides secure, HIPAA-compliant tools for healthcare professionals to manage patient information, process documents, and generate reports.

![NeoDocAi Dashboard](/placeholder.svg?height=400&width=800&query=nursing%20home%20management%20dashboard)

## Features

### Core Functionality
- **Nursing Home Management**: Create and manage multiple nursing home facilities
- **Patient Management**: Track patient information with secure record keeping
- **Document Management**: Upload, process, and organize patient and facility documents
- **PDF Processing**: Automated text extraction from PDF documents
- **Bulk Upload**: Efficiently process multiple documents at once
- **Reporting**: Generate customized reports for various timeframes and facilities

### Security & Compliance
- **User Authentication**: Secure login and session management
- **Role-Based Access Control**: Appropriate permissions for different user types
- **Comprehensive Audit Logging**: Track all system activities for compliance
- **HIPAA Compliance**: Designed with healthcare privacy regulations in mind

### User Experience
- **Intuitive Dashboard**: Clear overview of key metrics and recent activity
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: See processing status and system activities as they happen
- **Guided Workflows**: Step-by-step processes for common tasks

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Server Components, Server Actions
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **PDF Processing**: PDF.js
- **UI Components**: shadcn/ui

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Git

### Installation

1. Clone the repository:

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up environment variables:
   Create a `.env.local` file with the following variables:
   \`\`\`
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   \`\`\`

4. Set up the database:
   Run the SQL scripts in the following order:
   - `schema.sql`
   - `schema-update.sql`
   - `queue-table.sql`
   - `schema-audit-logs.sql`

5. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deployment

The application can be deployed to Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure the environment variables
4. Deploy

## Architecture

NeoDocAi follows a modern web application architecture:

- **App Router**: Utilizes Next.js 14's App Router for server-side rendering and API routes
- **Server Components**: Leverages React Server Components for improved performance
- **Client Components**: Uses client-side React for interactive elements
- **Database Schema**:
  - `nursing_homes`: Stores facility information
  - `patients`: Manages patient records
  - `patient_files`: Tracks patient documents
  - `nursing_home_files`: Manages facility documents
  - `pdf_processing_queue`: Handles document processing workflow
  - `audit_logs`: Records all system activities

## Audit Logging System

The system includes comprehensive audit logging to track all activities:

### Logged Events
- User authentication (login/logout)
- Nursing home creation and management
- Patient creation and management
- File uploads, downloads, and viewing
- PDF processing operations
- Report generation
- Page views

### Audit Log Structure
Each log entry contains:
- User ID and email
- Action type
- Entity type and ID
- Timestamp
- IP address and user agent
- Additional context-specific details

### Viewing Audit Logs
Administrators can access the audit logs through the dedicated Audit Logs page, which provides filtering and search capabilities.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please contact [your-email@example.com](mailto:your-email@example.com).
\`\`\`

This README provides a comprehensive overview of your NeoDocAi project, including its features, technology stack, setup instructions, and architecture. It also highlights the audit logging system that you recently implemented. Feel free to customize it further with specific details about your implementation or additional sections as needed.

