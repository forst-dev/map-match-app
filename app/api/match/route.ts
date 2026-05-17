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

    // 1. 단축 URL 복원
    const resolvedUrls = await Promise.all(links.map(link => resolveRedirect(link.trim())));
    
    // 2. 첫 번째 링크만 타겟팅해서 파싱 로그 찍기
    const targetUrl = resolvedUrls[0];
    const myPlaceMatch = targetUrl.match(/myPlace\/folder\/([A-Za-z0-9]+)/);
    
    if (!myPlaceMatch || !myPlaceMatch[1]) {
      return NextResponse.json({ 
        error: `[ID 추출 실패] 원본 주소 분석 실패. 변환된 주소: ${targetUrl}` 
      }, { status: 400 });
    }

    const folderId = myPlaceMatch[1];
    
    // 3. 네이버 실제 서버에 요청 날려보기
    // 네이버 마이플레이스 폴더 조회 API 주소 패턴 검증용
    const apiUrl = `https://map.naver.com/p/api/myplace/folder/${folderId}/places?extDetail=true&lang=ko`;
    
    const response = await fetch(apiUrl, { headers: MOCK_HEADERS });
    const rawData = await response.json().catch(() => null);

    // 💡 [핵심] 네이버가 보내준 날것의 데이터를 프론트엔드로 쏴서 화면에 띄워버리기
    if (!response.ok || !rawData) {
      return NextResponse.json({ 
        error: `네이버 API 통신 실패 (Status: ${response.status}). folderId: ${folderId}` 
      }, { status: 400 });
    }

    // 네이버 데이터가 도대체 어떤 구조로 들어오는지 유저가 브라우저에서 바로 볼 수 있게 가로채기
    return NextResponse.json({
      success: false, // 일단 에러 블록으로 보내서 alert창으로 데이터를 뽑아봅니다.
      error: `[네이버 응답 성공!] 데이터 구조: ${JSON.stringify(rawData).slice(0, 200)}...`
    }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: `최상위 에러: ${error.message}` }, { status: 500 });
  }
}