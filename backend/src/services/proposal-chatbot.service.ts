import { prisma } from '../lib/clients';
import axios from 'axios';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatbotResponse {
  text: string;
  audioUrl: string | null;
  suggestCallSalesperson: boolean;
  salespersonPhone?: string;
  salespersonName?: string;
}

// ─── Main Chatbot Handler ────────────────────────────────────────────────────

export async function handleChatbotMessage(input: {
  proposalId: string;
  message: string;
  language: string;
  conversationHistory: Message[];
}): Promise<ChatbotResponse> {
  // 1. Load proposal with all related data
  const proposal = await prisma.solarProposal.findUnique({
    where: { id: input.proposalId },
    include: {
      customer: true,
      lead: true,
      creator: true,
    },
  });

  if (!proposal) {
    throw new Error('Proposal not found');
  }

  // 2. Build context from proposal data
  const context = buildProposalContext(proposal);

  // 3. Detect if question is in scope
  const scope = await detectQuestionScope(input.message, context);

  if (scope === 'OUT_OF_SCOPE') {
    const response = getOutOfScopeResponse(input.language);
    return {
      text: response,
      audioUrl: null,
      suggestCallSalesperson: true,
      salespersonPhone: proposal.creator.phone || undefined,
      salespersonName: proposal.creator.name,
    };
  }

  // 4. Generate response using OpenAI
  const responseText = await generateResponse({
    question: input.message,
    context,
    conversationHistory: input.conversationHistory,
    language: input.language,
  });

  // 5. Generate voice response using Sarvam AI
  let audioUrl: string | null = null;
  try {
    audioUrl = await generateVoiceResponse(responseText || '', input.language);
  } catch (error) {
    console.error('Voice generation failed:', error);
    // Continue without voice if it fails
  }

  return {
    text: responseText || '',
    audioUrl,
    suggestCallSalesperson: false,
  };
}

// ─── Context Builder ─────────────────────────────────────────────────────────

function buildProposalContext(proposal: any): string {
  const context = `
CUSTOMER INFORMATION:
- Name: ${proposal.customer?.name || proposal.lead?.name || 'Customer'}
- Location: ${proposal.customer?.address || proposal.lead?.address}, ${proposal.customer?.city || proposal.lead?.city}
- Phone: ${proposal.customer?.phone || proposal.lead?.phone}

SOLAR SYSTEM SPECIFICATIONS:
- System Size: ${proposal.systemSizeKw} kW
- Panel Count: ${proposal.panelCount} panels
- Panel Brand & Model: ${proposal.panelBrand} ${proposal.panelModel}
- Panel Wattage: ${proposal.panelWattage}W per panel
- Inverter: ${proposal.inverterBrand} ${proposal.inverterModel}
- Inverter Capacity: ${proposal.inverterCapacity} kW
- Structure Type: ${proposal.structureType || 'Standard mounting structure'}
- Roof Type: ${proposal.roofType || 'Not specified'}
- System Type: ${proposal.isDCR ? 'DCR (Domestic Content Requirement) compliant' : 'Standard'}

ENERGY GENERATION:
- Annual Generation: ${proposal.annualGeneration?.toLocaleString('en-IN')} kWh per year
- Monthly Average: ${Math.round(proposal.annualGeneration / 12).toLocaleString('en-IN')} kWh per month
- Daily Average: ${Math.round(proposal.annualGeneration / 365)} kWh per day
- CO2 Savings: ${proposal.co2Savings} tonnes over 25 years
- Trees Equivalent: ${Math.round(proposal.co2Savings * 1000 / 22)} trees planted

FINANCIAL DETAILS:
- Total System Cost: ₹${proposal.totalCost?.toLocaleString('en-IN')}
- Subsidy Amount: ₹${proposal.subsidyAmount?.toLocaleString('en-IN')}
- Subsidy Scheme: ${proposal.subsidyScheme || 'PM Surya Ghar + Delhi CM Scheme'}
- Net Cost (After Subsidy): ₹${proposal.netCost?.toLocaleString('en-IN')}
- Payback Period: ${proposal.paybackYears || 'Not calculated'} years
- 25-Year Lifetime Savings: ₹${proposal.lifetimeSavings?.toLocaleString('en-IN')}
- Internal Rate of Return (IRR): ${proposal.irr || 'Not calculated'}%

LOAN DETAILS (if applicable):
${proposal.loanApplicable ? `
- Loan Amount: ₹${proposal.loanAmount?.toLocaleString('en-IN')}
- Interest Rate: ${proposal.loanRate}% per annum
- Loan Tenure: ${proposal.loanTenure} months (${Math.round(proposal.loanTenure / 12)} years)
- Monthly EMI: ₹${proposal.emi?.toLocaleString('en-IN')}
` : '- No loan financing selected'}

WARRANTY INFORMATION:
- Solar Panels: 25-year performance warranty (80% output guaranteed), 10-year product warranty
- Inverter: 5-year manufacturer warranty
- Installation Work: 1-year workmanship warranty
- Structure: 10-year warranty against rust and corrosion

INSTALLATION PROCESS:
1. Site survey and final measurements (1 day)
2. Material procurement (3-5 days)
3. Installation and commissioning (2-3 days)
4. Net metering application (handled by us)
5. Subsidy application assistance (handled by us)

MAINTENANCE:
- Minimal maintenance required
- Panel cleaning: 2-4 times per year (monsoon and winter)
- Annual inspection recommended
- Remote monitoring available

SALESPERSON CONTACT:
- Name: ${proposal.creator?.name}
- Phone: ${proposal.creator?.phone}
- Email: ${proposal.creator?.email}
  `.trim();

  return context;
}

// ─── Scope Detection ─────────────────────────────────────────────────────────

async function detectQuestionScope(
  question: string,
  context: string
): Promise<'IN_SCOPE' | 'OUT_OF_SCOPE'> {
  const prompt = `You are a scope detector for a solar proposal chatbot. Determine if the following question can be answered using the proposal information provided, or if it requires human intervention.

IN-SCOPE questions (can be answered by bot):
- Questions about system specifications (size, panels, inverter)
- Questions about costs, savings, payback period
- Questions about subsidies and financing
- Questions about energy generation and environmental benefits
- Questions about warranties and maintenance
- General questions about how solar works
- Questions about the installation process
- Questions about ROI and financial benefits

OUT-OF-SCOPE questions (need salesperson):
- Requests to change system design or specifications
- Pricing negotiations or custom discounts
- Specific installation date scheduling
- Payment terms negotiation
- Technical modifications to the proposal
- Questions about other products or services
- Complaints or issues requiring escalation

Context:
${context}

Question: "${question}"

Respond with only "IN_SCOPE" or "OUT_OF_SCOPE".`;

  try {
    const response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 10,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'Slar CRM Solar Chatbot',
        },
      }
    );

    const result = response.data.choices[0].message.content?.trim().toUpperCase();
    return result === 'OUT_OF_SCOPE' ? 'OUT_OF_SCOPE' : 'IN_SCOPE';
  } catch (error) {
    console.error('Scope detection error:', error);
    // Default to IN_SCOPE if detection fails
    return 'IN_SCOPE';
  }
}

// ─── Response Generator ──────────────────────────────────────────────────────

async function generateResponse(input: {
  question: string;
  context: string;
  conversationHistory: Message[];
  language: string;
}): Promise<string | null> {
  const languageInstructions = {
    en: 'Respond in English.',
    hi: 'Respond in Hindi (Devanagari script).',
    ta: 'Respond in Tamil.',
    te: 'Respond in Telugu.',
    mr: 'Respond in Marathi.',
    bn: 'Respond in Bengali.',
  };

  const systemPrompt = `You are a helpful and friendly solar proposal assistant for Slar CRM. Your role is to help customers understand their solar proposal and answer questions about solar energy.

GUIDELINES:
1. Be warm, friendly, and conversational
2. Use simple language that non-technical customers can understand
3. Use emojis occasionally to make responses engaging (☀️ 💰 🌱 ⚡ 🏠)
4. Keep responses concise but informative (2-4 sentences usually)
5. Always cite specific numbers from the proposal when relevant
6. If asked about savings, break down by timeframes (1 year, 5 years, 10 years, 25 years)
7. Emphasize environmental benefits when relevant
8. Be enthusiastic about solar energy but honest about limitations
9. ${(languageInstructions as Record<string, string>)[input.language] || languageInstructions.en}

PROPOSAL CONTEXT:
${input.context}

Remember: You can only answer questions based on the proposal information above. If asked about anything requiring changes or negotiations, politely suggest contacting the salesperson.`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...input.conversationHistory.slice(-5), // Last 5 messages for context
    { role: 'user', content: input.question },
  ];

  try {
    const response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: 'openai/gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'Slar CRM Solar Chatbot',
        },
      }
    );

    return response.data.choices[0].message.content || 'I apologize, but I could not generate a response. Please try again.';
  } catch (error) {
    console.error('OpenRouter error:', error);
    throw new Error('Failed to generate response');
  }
}

// ─── Out-of-Scope Responses ──────────────────────────────────────────────────

function getOutOfScopeResponse(language: string): string {
  const responses = {
    en: `I'd love to help with that, but this question is best answered by your dedicated salesperson who can provide personalized assistance and make any necessary changes to your proposal.

Would you like me to connect you with them? They'll be happy to help! 📞

In the meantime, I can answer questions about your system specifications, costs, savings, warranties, and how solar works!`,

    hi: `मैं इसमें मदद करना चाहूंगा, लेकिन यह सवाल आपके समर्पित सेल्सपर्सन द्वारा सबसे अच्छा उत्तर दिया जा सकता है जो व्यक्तिगत सहायता प्रदान कर सकते हैं और आपके प्रस्ताव में आवश्यक बदलाव कर सकते हैं।

क्या आप चाहेंगे कि मैं आपको उनसे जोड़ दूं? वे मदद करने में खुश होंगे! 📞

इस बीच, मैं आपके सिस्टम विनिर्देशों, लागत, बचत, वारंटी और सोलर कैसे काम करता है, के बारे में सवालों के जवाब दे सकता हूं!`,

    ta: `நான் இதில் உதவ விரும்புகிறேன், ஆனால் இந்த கேள்விக்கு உங்கள் அர்ப்பணிப்புள்ள விற்பனையாளரால் சிறந்த பதில் அளிக்க முடியும், அவர் தனிப்பயனாக்கப்பட்ட உதவியை வழங்கலாம் மற்றும் உங்கள் திட்டத்தில் தேவையான மாற்றங்களைச் செய்யலாம்.

நான் உங்களை அவர்களுடன் இணைக்க விரும்புகிறீர்களா? அவர்கள் உதவ மகிழ்ச்சியாக இருப்பார்கள்! 📞

இதற்கிடையில், உங்கள் அமைப்பு விவரக்குறிப்புகள், செலவுகள், சேமிப்பு, உத்தரவாதங்கள் மற்றும் சூரிய ஒளி எவ்வாறு செயல்படுகிறது என்பது பற்றிய கேள்விகளுக்கு என்னால் பதிலளிக்க முடியும்!`,

    te: `నేను దీనిలో సహాయం చేయాలనుకుంటున్నాను, కానీ ఈ ప్రశ్నకు మీ అంకితమైన సేల్స్‌పర్సన్ ద్వారా ఉత్తమ సమాధానం ఇవ్వబడుతుంది, వారు వ్యక్తిగత సహాయాన్ని అందించగలరు మరియు మీ ప్రతిపాదనలో అవసరమైన మార్పులు చేయగలరు।

నేను మిమ్మల్ని వారితో కనెక్ట్ చేయాలనుకుంటున్నారా? వారు సహాయం చేయడానికి సంతోషిస్తారు! 📞

ఈ మధ్యలో, మీ సిస్టమ్ స్పెసిఫికేషన్లు, ఖర్చులు, పొదుపులు, వారంటీలు మరియు సౌర శక్తి ఎలా పనిచేస్తుందనే దాని గురించి ప్రశ్నలకు నేను సమాధానం ఇవ్వగలను!`,

    mr: `मला यात मदत करायला आवडेल, परंतु या प्रश्नाचे उत्तर तुमच्या समर्पित सेल्सपर्सनद्वारे सर्वोत्तम दिले जाऊ शकते जे वैयक्तिक सहाय्य प्रदान करू शकतात आणि तुमच्या प्रस्तावात आवश्यक बदल करू शकतात।

तुम्हाला मी तुम्हाला त्यांच्याशी जोडावे असे वाटते का? ते मदत करण्यास आनंदित असतील! 📞

दरम्यान, मी तुमच्या सिस्टम तपशील, खर्च, बचत, वॉरंटी आणि सोलर कसे काम करते याबद्दल प्रश्नांची उत्तरे देऊ शकतो!`,

    bn: `আমি এতে সাহায্য করতে চাই, তবে এই প্রশ্নের উত্তর আপনার নিবেদিত বিক্রয়কর্মী দ্বারা সর্বোত্তম দেওয়া যেতে পারে যিনি ব্যক্তিগত সহায়তা প্রদান করতে পারেন এবং আপনার প্রস্তাবে প্রয়োজনীয় পরিবর্তন করতে পারেন।

আপনি কি চান আমি আপনাকে তাদের সাথে সংযুক্ত করি? তারা সাহায্য করতে খুশি হবে! 📞

এই সময়ে, আমি আপনার সিস্টেম স্পেসিফিকেশন, খরচ, সঞ্চয়, ওয়ারেন্টি এবং সৌর কীভাবে কাজ করে সে সম্পর্কে প্রশ্নের উত্তর দিতে পারি!`,
  };

  return (responses as Record<string, string>)[language] || responses.en;
}

// ─── Voice Generation (Sarvam AI) ────────────────────────────────────────────

async function generateVoiceResponse(
  text: string,
  language: string
): Promise<string | null> {
  if (!process.env.SARVAM_AI_API_KEY) {
    console.warn('Sarvam AI API key not configured');
    return null;
  }

  try {
    const response = await axios.post(
      'https://api.sarvam.ai/text-to-speech',
      {
        inputs: [text],
        target_language_code: mapLanguageCode(language),
        speaker: 'meera', // Female voice
        pitch: 0,
        pace: 1.0,
        loudness: 1.5,
        speech_sample_rate: 8000,
        enable_preprocessing: true,
        model: 'bulbul:v1',
      },
      {
        headers: {
          'api-subscription-key': process.env.SARVAM_AI_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    // Upload audio to S3 (implement your S3 upload logic)
    const audioBuffer = Buffer.from(response.data);
    const audioUrl = await uploadAudioToS3(audioBuffer);
    
    return audioUrl;
  } catch (error) {
    console.error('Sarvam AI error:', error);
    throw error;
  }
}

function mapLanguageCode(lang: string): string {
  const mapping = {
    en: 'en-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    mr: 'mr-IN',
    bn: 'bn-IN',
  };
  return (mapping as Record<string, string>)[lang] || 'en-IN';
}

// ─── Audio Transcription (Sarvam AI) ─────────────────────────────────────────

export async function transcribeAudio(
  audioBuffer: Buffer,
  language: string
): Promise<string | null> {
  if (!process.env.SARVAM_AI_API_KEY) {
    throw new Error('Sarvam AI API key not configured');
  }

  try {
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename: 'audio.webm' });
    formData.append('language_code', mapLanguageCode(language));
    formData.append('model', 'saaras:v1');

    const response = await axios.post(
      'https://api.sarvam.ai/speech-to-text',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'api-subscription-key': process.env.SARVAM_AI_API_KEY,
        },
      }
    );

    return response.data.transcript || '';
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

// ─── S3 Upload Helper ────────────────────────────────────────────────────────

async function uploadAudioToS3(audioBuffer: Buffer): Promise<string | null> {
  // Implement your S3 upload logic here
  // This is a placeholder - integrate with your existing S3 service
  const { uploadToS3 } = require('../utils/s3');
  
  const filename = `chatbot-audio/${Date.now()}.mp3`;
  const url = await uploadToS3(audioBuffer, filename, 'audio/mpeg');
  
  return url;
}
