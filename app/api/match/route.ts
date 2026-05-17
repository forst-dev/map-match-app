import { NextRequest, NextResponse } from 'next/server';

interface ResolveRequest {
  links: string[];
}

interface ResolveResponse {
  resolvedUrls: string[];
  errors: Array<{ index: number; link: string; error: string }>;
}

async function resolveRedirect(url: string, maxRedirects = 10): Promise<string> {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const location = response.headers.get('location');

      if (location) {
        // Handle relative URLs
        currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
        redirectCount++;
      } else {
        // No more redirects, return the final URL
        return currentUrl;
      }
    } catch (error) {
      throw new Error(`Failed to resolve redirect: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error('Too many redirects');
}

export async function POST(request: NextRequest) {
  try {
    const body: ResolveRequest = await request.json();

    if (!body.links || !Array.isArray(body.links)) {
      return NextResponse.json(
        { error: 'Invalid request body: links array is required' },
        { status: 400 }
      );
    }

    const resolvedUrls: string[] = [];
    const errors: Array<{ index: number; link: string; error: string }> = [];

    await Promise.all(
      body.links.map(async (link, index) => {
        if (!link || typeof link !== 'string') {
          errors.push({ index, link, error: 'Invalid link format' });
          return;
        }

        try {
          const resolvedUrl = await resolveRedirect(link.trim());
          resolvedUrls[index] = resolvedUrl;
        } catch (error) {
          errors.push({
            index,
            link,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
    );

    const response: ResolveResponse = {
      resolvedUrls,
      errors,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
