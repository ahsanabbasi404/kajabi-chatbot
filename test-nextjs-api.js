const fs = require('fs');
const path = require('path');

/**
 * Test the Next.js PDF generation API
 */
async function testNextjsAPI() {
  // Test with minimal data - only items, estimate number, and 'to' field
  // This simulates what your agent will provide
  const testData = {
    estimateNumber: '00031',
    to: 'Jane Smith\nABC Corporation\n789 Corporate Blvd\nCorporate City, CC 12345',
    items: [
      { description: 'Consultation services', units: 10, cost: 540, amount: 5400 },
      { description: 'Installation work', units: 5, cost: 200, amount: 1000 },
      { description: 'Testing and validation', units: 2, cost: 300, amount: 600 }
    ],
    email: 'abbasiahsan699@gmail.com'
  };

  try {
    console.log('🚀 Testing Next.js PDF API...');
    console.log(`📊 Test Data: Estimate ${testData.estimateNumber}`);
    
    const response = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorData}`);
    }

    const pdfBuffer = await response.arrayBuffer();
    const pdfData = Buffer.from(pdfBuffer);
    
    console.log(`✅ PDF generated successfully!`);
    console.log(`📊 PDF size: ${pdfData.length} bytes`);
    console.log(`🏷️  Estimate Number: ${testData.estimateNumber}`);
    
    // Calculate total for logging
    const total = testData.items.reduce((sum, item) => sum + (item.amount || (item.units * item.cost) || 0), 0);
    console.log(`💰 Total Amount: $${total.toFixed(2)}`);
    
    // Save the PDF file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputPath = path.join(__dirname, `nextjs-api-test-estimate-${timestamp}.pdf`);
    fs.writeFileSync(outputPath, pdfData);
    
    console.log(`💾 PDF saved to: ${outputPath}`);
    console.log('🎉 Next.js API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Next.js API test failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

// Run the test
testNextjsAPI();