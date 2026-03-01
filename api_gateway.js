// API Gateway (Cloudflare Worker Style)
// Routes requests to appropriate services

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Basic Routing
  if (path.startsWith('/api/naming')) {
    return handleNaming(request);
  } else if (path.startsWith('/api/payment')) {
    return handlePayment(request);
  } else if (path.startsWith('/api/referral')) {
    return handleReferral(request);
  }

  return new Response('Not Found', { status: 404 });
}

async function handleNaming(request) {
  // Simulate calling python script via bridge
  // In real implementation, this would trigger a serverless function or container
  const data = await request.json();
  if (!data.name || !data.birth) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }

  // TODO: Call `report_bridge.js`
  return new Response(JSON.stringify({ 
    status: "success", 
    message: "Report generated", 
    report_url: "/reports/temp_123.html" 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
