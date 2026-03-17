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

export default async function handler() {
    try {
        const res = await fetch(MEDIUM_RSS_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
            cache: "no-store",
        })

        const xml = await res.text()
        const items = parseItems(xml)

        return new Response(JSON.stringify({ items }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, s-maxage=60",
            },
        })
    } catch {
        return new Response(JSON.stringify({ error: "Failed" }), {
            status: 500,
        })
    }
}