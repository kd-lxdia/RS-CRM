/**
 * Test script to verify Sarvam AI Voice System
 * Run with: node test-voice-system.js
 */

const axios = require('axios');

const SARVAM_API_KEY = (process.env.SARVAM_API_KEY || '');
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '');

async function testSarvamTTS() {
  console.log('\n🎤 Testing Sarvam TTS (Text-to-Speech)...');
  try {
    const response = await axios.post(
      'https://api.sarvam.ai/text-to-speech',
      {
        inputs: ['Hello, I am testing the Sarvam text to speech API.'],
        target_language_code: 'hi-IN',
        speaker: 'priya', // Female voice compatible with v3
        pace: 1.0,
        speech_sample_rate: 16000,
        enable_preprocessing: true,
        model: 'bulbul:v3' // V3 doesn't support pitch and loudness
      },
      {
        headers: {
          'api-subscription-key': SARVAM_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000,
      }
    );
    
    if (response.data && response.data.audios && response.data.audios.length > 0) {
      console.log('✅ Sarvam TTS: SUCCESS');
      console.log(`   Audio length: ${response.data.audios[0].length} characters (base64)`);
      return true;
    } else {
      console.log('❌ Sarvam TTS: No audio returned');
      return false;
    }
  } catch (error) {
    console.log('❌ Sarvam TTS: FAILED');
    console.log('   Error:', error.response?.data || error.message);
    return false;
  }
}

async function testOpenRouter() {
  console.log('\n🤖 Testing OpenRouter LLM...');
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3.1-8b-instruct', // Removed :free suffix
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello in one sentence.' }
        ],
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Slar CRM Test'
        },
        timeout: 30000,
      }
    );
    
    if (response.data && response.data.choices && response.data.choices[0]) {
      const message = response.data.choices[0].message.content;
      console.log('✅ OpenRouter LLM: SUCCESS');
      console.log(`   Response: "${message}"`);
      return true;
    } else {
      console.log('❌ OpenRouter LLM: No response');
      return false;
    }
  } catch (error) {
    console.log('❌ OpenRouter LLM: FAILED');
    console.log('   Error:', error.response?.data || error.message);
    return false;
  }
}

async function testBackendHealth() {
  console.log('\n🏥 Testing Backend Health...');
  try {
    // Just try to connect to the backend root
    const response = await axios.get('http://localhost:4000/', {
      timeout: 5000,
    });
    console.log('✅ Backend: RUNNING');
    return true;
  } catch (error) {
    if (error.response && error.response.status) {
      // Got a response, backend is running
      console.log('✅ Backend: RUNNING');
      return true;
    }
    console.log('❌ Backend: NOT RESPONDING');
    console.log('   Make sure backend is running on port 4000');
    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   Slar CRM - Voice System Test Suite');
  console.log('═══════════════════════════════════════════════════');
  
  const results = {
    backend: await testBackendHealth(),
    tts: await testSarvamTTS(),
    llm: await testOpenRouter(),
  };
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   Test Results Summary');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Backend Health:  ${results.backend ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Sarvam TTS:      ${results.tts ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`OpenRouter LLM:  ${results.llm ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Voice system is ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
  
  console.log('═══════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
