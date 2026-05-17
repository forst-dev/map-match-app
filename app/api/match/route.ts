import { NextRequest, NextResponse } from 'next/server';

const MOCK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin': 'https://map.naver.com',
  'Referer': 'https://map.naver.com/'
};

async function resolveRedirect(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': MOCK_HEADERS['User-Agent'] },
    });
    const location = response.headers.get('location');
    return location ? (location.startsWith('http') ? location : new URL(location, url).href) : url;
  } catch (error) {
    return url;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { links } = await req.json();
    if (!links || !Array.isArray(links) || links.length < 2) {
      return NextResponse.json({ error: '최소 2개 이상의 링크를 입력해주세요.' }, { status: 400 });
    }

    const resolvedUrls = await Promise.all(links.map(link => resolveRedirect(link.trim())));
    const targetUrl = resolvedUrls[0];
    const myPlaceMatch = targetUrl.match(/myPlace\/folder\/([A-Za-z0-9]+)/);
    
    if (!myPlaceMatch || !myPlaceMatch[1]) {
      return NextResponse.json({ error: `주소 분석 실패: ${targetUrl}` }, { status: 400 });
    }

    const folderId = myPlaceMatch[1];
    const apiUrl = `https://map.naver.com/p/api/myplace/folder/${folderId}?lang=ko`;
    
    const response = await fetch(apiUrl, { headers: MOCK_HEADERS });
    const rawData = await response.json().catch(() => null);

    if (!response.ok || !rawData) {
      return NextResponse.json({ error: `네이버 통신 실패 (Status: ${response.status})` }, { status: 400 });
    }

    // 💡 [핵심 진단] 네이버가 최상위에 어떤 Key들을 들고 왔는지 한눈에 파악하기
    // 예: "가져온 Key 목록: [result, code, message, folderInfo]" 같은 식으로 프론트엔드에 강제 전송합니다.
    const topKeys = Object.keys(rawData);
    
    // 만약 특정 내포된 객체가 있다면 그 안의 Key까지 추적하기 위한 샘플 쪼개기
    let detailHint = "";
    if (rawData.result) detailHint = ` / result 안의 Key: [${Object.keys(rawData.result).join(', ')}]`;
    else if (rawData.data) detailHint = ` / data 안의 Key: [${Object.keys(rawData.data).join(', ')}]`;

    return NextResponse.json({
      success: false, // 의도적으로 결과 화면 진입을 막고 alert창을 띄웁니다.
      error: `[진단 성공] 최상위 Key: [${topKeys.join(', ')}]${detailHint}`
    }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: `최상위 에러: ${error.message}` }, { status: 500 });
  }
}