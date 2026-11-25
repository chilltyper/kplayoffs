
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Allow browser requests from the website.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    // Simple endpoint to check whether the Worker is running.
    if (url.pathname === "/api/health") {
      return jsonResponse({
        ok: true,
        service: "Klavia Playoffs API",
        message: "Worker is running."
      });
    }

    // Match URLs such as /api/comps/3130.
    const match = url.pathname.match(/^\/api\/comps\/(\d+)$/);

    if (!match) {
      return jsonResponse({
        error: "Unknown endpoint.",
        availableEndpoints: [
          "/api/health",
          "/api/comps/3130"
        ]
      }, 404);
    }

    const competitionId = match[1];

	// Require the private sync key for competition data.
	if (
	!env.SYNC_KEY ||
	request.headers.get("X-Sync-Key") !== env.SYNC_KEY
	) {
	return jsonResponse({
		error: "Unauthorized. A valid sync key is required."
	}, 401);
	}
    // Make sure the secret exists.
    if (!env.KLAVIA_API_TOKEN) {
      return jsonResponse({
        error: "Klavia API token is not configured."
      }, 500);
    }

    try {
      const response = await fetch(
        `https://klavia.io/api/v1/comps/${competitionId}`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${env.KLAVIA_API_TOKEN}`
          }
        }
      );

      if (!response.ok) {
        return jsonResponse({
          error: "Klavia API request failed.",
          upstreamStatus: response.status
        }, 502);
      }

      const data = await response.json();

      if (!Array.isArray(data.racers)) {
        return jsonResponse({
          error: "Unexpected response from Klavia.",
          message: "The racers array was not found."
        }, 502);
      }

      return jsonResponse({
        competitionId: Number(competitionId),
        racerCount: data.racers.length,
        racers: data.racers
      });

    } catch (error) {
      return jsonResponse({
        error: "Could not retrieve competition data.",
        details: error.message
      }, 500);
    }
  }
};
