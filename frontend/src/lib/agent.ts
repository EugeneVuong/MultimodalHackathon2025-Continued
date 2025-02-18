export async function queryAgent(query: string): Promise<string> {
  try {
    const response = await fetch("http://0.0.0.0:8000/search", {
      method: "POST",
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
        "Content-Type": "application/json",
        Origin: "http://0.0.0.0:8000",
        Referer: "http://0.0.0.0:8000/docs",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
        accept: "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data.result.output;
  } catch (error) {
    console.error("Error querying agent:", error);
    throw error;
  }
}
