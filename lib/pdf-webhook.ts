import { NextResponse } from 'next/server';

interface EstimateItem {
  description: string;
  units: number;
  cost: number;
  amount: number;
}

interface GeneratePDFParams {
  to: string;
  items: EstimateItem[];
  email?: string;
  clientName?: string;
}

// Make.com webhook URL - this should be set as an environment variable
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || 'https://hook.us2.make.com/gi1uvve8f5a7x0fyalt9uycqabolv8os';

export async function generatePDFEstimate(params: GeneratePDFParams): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    console.log('Generating PDF estimate with params:', JSON.stringify(params, null, 2));
    
    // Prepare the data to send to Make.com webhook
    const webhookData = {
      to: params.to,
      items: params.items,
      email: params.email,
      clientName: params.clientName,
      timestamp: new Date().toISOString(),
      source: 'openai-assistant'
    };
    console.log('items is', params.items);
    console.log('Sending data to Make.com webhook:', MAKE_WEBHOOK_URL);
    console.log('webhook Data: ', webhookData);
    // Send data to Make.com webhook
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Make.com webhook error:', response.status, errorText);
      throw new Error(`Webhook request failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.text();
    console.log('Make.com webhook response:', result);
    
    return {
      success: true,
      message: `PDF estimate generation initiated successfully. ${params.email ? `PDF will be sent to ${params.email}` : 'PDF generation in progress.'}`
    };
    
  } catch (error) {
    console.error('Error in generatePDFEstimate:', error);
    return {
      success: false,
      message: 'Failed to generate PDF estimate',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Helper function to validate estimate data
export function validateEstimateData(params: any): { valid: boolean; error?: string } {
  if (!params.to || typeof params.to !== 'string') {
    return { valid: false, error: 'Missing or invalid "to" field (client information)' };
  }
  
  if (!params.items || !Array.isArray(params.items) || params.items.length === 0) {
    return { valid: false, error: 'Missing or invalid "items" field (must be a non-empty array)' };
  }
  
  for (let i = 0; i < params.items.length; i++) {
    const item = params.items[i];
    if (!item.description || typeof item.description !== 'string') {
      return { valid: false, error: `Item ${i + 1}: Missing or invalid description` };
    }
    if (typeof item.units !== 'number' || item.units <= 0) {
      return { valid: false, error: `Item ${i + 1}: Invalid units (must be a positive number)` };
    }
    if (typeof item.cost !== 'number' || item.cost < 0) {
      return { valid: false, error: `Item ${i + 1}: Invalid cost (must be a non-negative number)` };
    }
    if (typeof item.amount !== 'number' || item.amount < 0) {
      return { valid: false, error: `Item ${i + 1}: Invalid amount (must be a non-negative number)` };
    }
  }
  
  if (params.email && typeof params.email !== 'string') {
    return { valid: false, error: 'Invalid email field (must be a string)' };
  }
  
  if (params.clientName && typeof params.clientName !== 'string') {
    return { valid: false, error: 'Invalid clientName field (must be a string)' };
  }
  
  return { valid: true };
}