import { NextRequest, NextResponse } from 'next/server';
import { generateEstimatePDFBackup } from '../../../lib/estimate-to-pdf-backup';

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
console.log("🪵 RAW request body:", raw);
let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error("❌ JSON parse failed:", err);
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}
console.log("✅ Parsed data:", data);
    console.log('📥 PDF Generation Request received');
    // const data = await request.json();
    // console.log('📋 JSON data received:', data);
    
    const { to, items, email } = data;
    
    console.log('🔍 Data validation:');
    console.log('  - to field:', to ? '✅ Valid' : '❌ Missing');
    console.log('  - items count:', items?.length || 0);
    
    // Validate required fields
    if (!to || !items || items.length === 0) {
      console.log('❌ Validation failed: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: to and items are required' },
        { status: 400 }
      );
    }
    
    console.log('✅ Validation passed, generating PDF...');

    // Generate PDF using the serverless-compatible backup method
    const startTime = Date.now();
    const estimateNumber = '00001'; // Default estimate number
    const pdfBuffer = await generateEstimatePDFBackup({
      to,
      email,
      items,
      estimateNumber
    });
    const generationTime = Date.now() - startTime;
    
    console.log('✅ PDF generated successfully!');
    console.log(`  - Generation time: ${generationTime}ms`);
    console.log(`  - PDF size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
    console.log(`  - Filename: estimate-${estimateNumber}.pdf`);
    
    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="estimate-${estimateNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('💥 Error generating PDF:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}