/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
}

async function sendSMTPEmail(to: string, subject: string, body: string): Promise<void> {
  const smtpHost = Deno.env.get('SMTP_HOST') || 'supabase-mailpit'
  const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '1025')
  const smtpFrom = Deno.env.get('SMTP_SENDER_EMAIL') || 'noreply@denog.de'
  const smtpFromName = Deno.env.get('SMTP_SENDER_NAME') || 'DENOG Event Team'

  console.log(`Connecting to SMTP server ${smtpHost}:${smtpPort}`)

  // Connect to SMTP server
  const conn = await Deno.connect({ hostname: smtpHost, port: smtpPort })
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  // Helper to read response
  const readResponse = async (): Promise<string> => {
    const buffer = new Uint8Array(1024)
    const n = await conn.read(buffer)
    if (n === null) throw new Error('Connection closed')
    return decoder.decode(buffer.subarray(0, n))
  }

  // Helper to send command
  const sendCommand = async (command: string): Promise<string> => {
    console.log(`> ${command}`)
    await conn.write(encoder.encode(command + '\r\n'))
    const response = await readResponse()
    console.log(`< ${response.trim()}`)
    return response
  }

  try {
    // Read server greeting
    await readResponse()

    // SMTP conversation
    await sendCommand(`EHLO ${smtpHost}`)
    await sendCommand(`MAIL FROM:<${smtpFrom}>`)
    await sendCommand(`RCPT TO:<${to}>`)
    await sendCommand('DATA')

    // Send email content
    const emailContent = [
      `From: ${smtpFromName} <${smtpFrom}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
      '.',
    ].join('\r\n')

    await conn.write(encoder.encode(emailContent + '\r\n'))
    await readResponse()

    // Close connection
    await sendCommand('QUIT')
  } finally {
    conn.close()
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, body }: EmailRequest = await req.json()

    console.log(`Sending email to ${to}`)

    await sendSMTPEmail(to, subject, body)

    console.log(`Email sent successfully to ${to}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
