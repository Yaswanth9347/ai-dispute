# Database Migration for Password Reset

## Steps to Enable Password Reset Functionality

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Migration**
   - Copy the SQL from `backend/sql/add_password_reset_columns.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute

4. **Verify the Changes**
   - Go to "Table Editor" → "users" table
   - Check that you now have:
     - `reset_token_hash` (text column)
     - `reset_token_expires_at` (timestamptz column)

## What This Enables

- ✅ Forgot password functionality
- ✅ Secure password reset via email
- ✅ Token expiration (1 hour)
- ✅ One-time use reset tokens

## Testing the Flow

1. Go to `/auth/forgot-password`
2. Enter your email
3. Check email for reset link (if email service is configured)
4. Click link to reset password
5. Enter new password
6. Login with new password

## Email Configuration

To send actual emails, configure these environment variables in `backend/.env`:

```env
# Email Service (optional - for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourdomain.com
```

For development, the backend will log the reset URL to the console instead of sending email.
