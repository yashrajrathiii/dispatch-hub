import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY secret is not configured in Supabase. Please set it using: supabase secrets set GEMINI_API_KEY=your_key",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { image, mimeType } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "Missing image base64 data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Gemini API 3.1 Flash Lite
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    
    const promptText = `Analyze this bank cheque image and extract the following details as a structured JSON object. Return a JSON object matching this schema:
{
  "date": "YYYY-MM-DD" or null,
  "party_name": "exact name of the drawer/payee/payer on the cheque" or null,
  "check_number": "cheque number" or null,
  "bank_name": "issuing bank name" or null,
  "amount": number or null
}
Guidelines:
1. Ensure 'date' is formatted exactly as YYYY-MM-DD. Convert hand-written formats (like DD/MM/YY, e.g. 16/06/26 -> 2026-06-16).
2. The check_number is strictly the FIRST 6-digit number on the far left at the bottom of the cheque in the MICR band (usually enclosed in symbols like ⑈, e.g., ⑈001155⑈ should extract "001155"). Never select any other 6-digit numbers in the middle or right of the bottom MICR band (which represent transaction or bank account codes, like "500288"). It must contain all 6 digits including leading zeros.
3. The party_name is strictly the business or individual who issued/signed the cheque (the payer/drawer), typically located at the bottom-right corner of the cheque under or near the signature line (often prefixed with "For", e.g., "For GHANSHYAM PROVISION STORES" -> "GHANSHYAM PROVISION STORES" or "ANANTRA MART"). Do NOT extract the payee (the person/business to whom the cheque is written next to "Pay", e.g., "Shree Jee Sales"), as that is the receiver of the cheque (the app owner).
4. The amount should be a numeric value representing the check value (e.g. 14433).
Return ONLY the raw JSON output. Do not wrap the JSON output in markdown backticks or any other text.`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: promptText,
            },
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiPayload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(`Gemini API returned error: ${JSON.stringify(result)}`);
    }

    // Extract text response
    const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      throw new Error("No response candidates returned from Gemini Vision API.");
    }

    // Parse text output as JSON to verify structure and clean up
    let parsedData;
    try {
      parsedData = JSON.parse(textOutput);
    } catch (e) {
      // Fallback in case response has backticks
      const cleaned = textOutput.replace(/```json|```/g, "").trim();
      parsedData = JSON.parse(cleaned);
    }

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
