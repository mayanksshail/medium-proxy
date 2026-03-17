export const config = {
    runtime: "edge",
}

const MEDIUM_RSS_URL = "https://medium.com/feed/@sunilsingh-42118"

type FeedItem = {
    guid: string
    title: string
    link: string
    pubDate: string
    description: string
    image: string
}

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

function extractImageFromDescription(html: string) {
    if (!html) return ""
    const match = html.match(/<img[^>]+src="([^">]+)"/i)
    return match?.[1] ?? ""
}

function extractOgImage(html: string) {
    if (!html) return ""

    const matchA = html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    )
    if (matchA?.[1]) return matchA[1]

    const matchB = html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    )
    if (matchB?.[1]) return matchB[1]

    return ""
}

function parseItems(xml: string): FeedItem[] {
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? []

    return itemMatches.map((itemXml) => {
        const description = decodeXml(getTagValue(itemXml, "description"))

        return {
            guid: decodeXml(getTagValue(itemXml, "guid")),
            title: decodeXml(getTagValue(itemXml, "title")),
            link: decodeXml(getTagValue(itemXml, "link")),
            pubDate: decodeXml(getTagValue(itemXml, "pubDate")),
            description,
            image: extractImageFromDescription(description),
        }
    })
}

function corsHeaders(contentType = "application/json") {
    return {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
    }
}

async function enrichItemImage(item: FeedItem): Promise<FeedItem> {
    if (item.image) return item

    try {
        const res = await fetch(item.link, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                Accept: "text/html,application/xhtml+xml",
            },
            cache: "no-store",
        })

        if (!res.ok) return item

        const html = await res.text()
        const ogImage = extractOgImage(html)

        return {
            ...item,
            image: ogImage || "",
        }
    } catch {
        return item
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
        const parsedItems = parseItems(xml)
        const items = await Promise.all(
            parsedItems.map((item) => enrichItemImage(item))
        )

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
