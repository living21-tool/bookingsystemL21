import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("Hello from Functions!");

interface ParsedBookingRequest {
    location?: string;
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
    bedCount?: number;
    intent: 'booking_request' | 'general_inquiry' | 'other';
}

// Mock function - in production use Deno.env.get('OPENAI_API_KEY')
async function parseMessageWithAI(message: string): Promise<ParsedBookingRequest> {
    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
        console.warn("OPENAI_API_KEY not set. Returning mock data.");
        // Fallback/Mock parser for testing without cost/key
        const lower = message.toLowerCase();
        const mockData: ParsedBookingRequest = { intent: 'booking_request' };

        // Simple regex heuristics for demo purposes if no key present
        if (lower.includes('berlin')) mockData.location = 'Berlin';
        if (lower.includes('hamburg')) mockData.location = 'Hamburg';
        const beds = lower.match(/(\d+)\s*(betten|beds)/);
        if (beds) mockData.bedCount = parseInt(beds[1]);

        // Mock dates for now if not parsed (in real AI we get them)
        mockData.startDate = '2026-02-12';
        mockData.endDate = '2026-02-20';

        return mockData;
    }

    // Real AI Call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a booking assistant for "Living21". 
          Extract the following data from the user's message as JSON:
          - location (string, infer city/place if possible)
          - startDate (YYYY-MM-DD)
          - endDate (YYYY-MM-DD)
          - bedCount (number)
          - intent (enum: 'booking_request', 'general_inquiry', 'other')
          
          Current Date: ${new Date().toISOString().split('T')[0]}
          
          If info is missing, leave the field null.
          Return ONLY valid JSON.`
                },
                { role: 'user', content: message }
            ],
            temperature: 0
        })
    });

    const data = await response.json();
    try {
        const content = data.choices[0].message.content;
        const jsonStr = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse AI response:", e);
        return { intent: 'other' };
    }
}

serve(async (req) => {
    try {
        // 1. Handle CORS
        if (req.method === 'OPTIONS') {
            return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        // 2. Only allow POST
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 3. Parse the body
        const body = await req.json();
        console.log("Received payload:", JSON.stringify(body, null, 2));

        // Support both Twilio webhook structure and direct JSON testing
        let message = "";
        let sender = "";

        if (body.message) {
            message = body.message;
            sender = body.sender || "Unknown";
        } else if (body.Body) {
            message = body.Body;
            sender = body.From || "WhatsAppUser";
        }

        if (!message) {
            return new Response(JSON.stringify({ message: "No message content found" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 4. AI Parsing
        const parsedData = await parseMessageWithAI(message);
        console.log("AI Parsed Data:", parsedData);

        // 5. Respond
        // For now, we echo back the parsed understanding to prove it works.
        const responseText = parsedData.intent === 'booking_request'
            ? `Danke! Ich habe verstanden: ${parsedData.bedCount || '?'} Betten in ${parsedData.location || '?'} vom ${parsedData.startDate || '?'} bis ${parsedData.endDate || '?'}. Ich prüfe die Verfügbarkeit...`
            : `Danke für deine Nachricht. Wie kann ich dir helfen?`;

        return new Response(
            JSON.stringify({
                success: true,
                originalMessage: message,
                parsed: parsedData,
                reply: responseText
            }),
            {
                headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
            }
        );

    } catch (error) {
        console.error("Error processing request:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
