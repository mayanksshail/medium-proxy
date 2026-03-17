export const config = {
    runtime: "edge",
}

const MEDIUM_RSS_URL = "https://medium.com/feed/@sunilsingh-42118"

function decodeXml(str: string = "") {
    return str
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
}

function getTagValue(xml: string, tag: string) {
    const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"))
    return match?.[1]?.trim() ?? ""
}

function parseItems(xml: string) {
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? []

    return itemMatches.map((itemXml) => ({
        guid: decodeXml(getTagValue(itemXml, "guid")),
        title: decodeXml(getTagValue(itemXml, "title")),
        link: decodeXml(getTagValue(itemXml, "link")),
        pubDate: decodeXml(getTagValue(itemXml, "pubDate")),
        description: decodeXml(getTagValue(itemXml, "description")),
    }))
}

function corsHeaders(contentType = "application/json") {
    return {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
    }
}

export default async function handler(req: Request) {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders(),
        })
    }

    try {
        const res = await fetch(MEDIUM_RSS_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
            },
            cache: "no-store",
        })

        if (!res.ok) {
            return new Response(
                JSON.stringify({ error: "Failed to fetch Medium RSS." }),
                {
                    status: 502,
                    headers: corsHeaders(),
                }
            )
        }

        const xml = await res.text()
        const items = parseItems(xml)

        return new Response(JSON.stringify({ items }), {
            status: 200,
            headers: corsHeaders(),
        })
    } catch {
        return new Response(JSON.stringify({ error: "Proxy error." }), {
            status: 500,
            headers: corsHeaders(),
        })
    }
}
