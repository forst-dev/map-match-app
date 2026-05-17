import { NextRequest, NextResponse } from 'next/server';

const MOCK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin': 'https://map.naver.com',
  'Referer': 'https://map.naver.com/'
};

// 단축 URL 해제 함수
async function resolveRedirect(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': MOCK_HEADERS['User-Agent'] },
    });
    
    const location = response.headers.get('location');
    if (location) {
      return location.startsWith('http') ? location : new URL(location, url).href;
    }
    return url;
  } catch (error) {
    return url;
  }
}

// 네이버 지도 리스트 데이터 긁어오기
async function fetchNaverMapList(listId: string): Promise<any[]> {
  try {
    const apiUrl = `https://map.naver.com/v5/api/bookmark/share/${listId}`;
    const response = await fetch(apiUrl, { headers: MOCK_HEADERS });

    if (!response.ok) return [];

    const data = await response.json();
    const items = data.bookmarkList?.transforms || data.bookmarkList?.items || [];
    
    return items.map((item: any) => ({
      name: item.name || item.title || '',
      category: item.displayCategory || item.category || '장소',
      address: item.address || item.roadAddress || '',
      naverUrl: `https://map.naver.com/v5/entry/place/${item.id || item.placeId}`
    })).filter((item: any) => item.name !== ''); // 이름 없는 데이터 제외
  } catch (e) {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { links } = await req.json();

    if (!links || !Array.isArray(links) || links.length < 2) {
      return NextResponse.json({ error: '최소 2개 이상의 링크를 입력해주세요.' }, { status: 400 });
    }

    // 1. URL 해제
    const resolvedUrls = await Promise.all(links.map(link => resolveRedirect(link.trim())));
    
    // 2. ID 추출
    const listIds = resolvedUrls.map(url => {
      const match = url.match(/(?:bookmarkListId|shareRoleId)=([A-Za-z0-9_-]+)/) || url.match(/bookmark\/share\/([A-Za-z0-9_-]+)/);
      return match ? match[1] : null;
    });

    if (listIds.some(id => !id)) {
      return NextResponse.json({ error: '올바른 네이버 지도 공유 리스트 링크가 포함되어 있지 않습니다.' }, { status: 400 });
    }

    // 3. 네이버 실제 데이터 로드
    const allListsResults = await Promise.all(listIds.map(id => fetchNaverMapList(id!)));

    // 💡 연결 실패 및 빈 리스트 방어벽
    if (allListsResults[0].length === 0) {
      return NextResponse.json({ error: '첫 번째 링크의 저장된 장소 데이터를 가져오지 못했습니다.' }, { status: 400 });
    }
    if (allListsResults[1].length === 0) {
      return NextResponse.json({ error: '두 번째 링크의 저장된 장소 데이터를 가져오지 못했습니다.' }, { status: 400 });
    }

    // 4. 순수 교집합(공통 장소) 추출 (공백 제거 후 비교)
    const firstList = allListsResults[0];
    const restLists = allListsResults.slice(1);

    const commonPlaces = firstList.filter(placeA => 
      restLists.every(subList => 
        subList.some((placeB: any) => placeB.name.replace(/\s+/g, '') === placeA.name.replace(/\s+/g, ''))
      )
    );

    // 5. 일치율 계산
    const totalUniqueCount = new Set([...allListsResults.flat()].map(p => p.name)).size;
    const matchRate = totalUniqueCount > 0 ? Math.round((commonPlaces.length / totalUniqueCount) * 100) : 0;

    return NextResponse.json({
      success: true,
      matchRate: matchRate,
      places: commonPlaces
    });

  } catch (error) {
    return NextResponse.json({ error: '네이버 지도 서버와 통신 중 문제가 발생했습니다.' }, { status: 500 });
  }
}