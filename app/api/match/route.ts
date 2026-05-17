import { NextRequest, NextResponse } from 'next/server';

// 단축 URL을 원본 네이버 지도 URL로 풀어주는 함수
async function resolveRedirect(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const location = response.headers.get('location');
    return location || url;
  } catch (error) {
    return url;
  }
}

// 네이버 지도 리스트 ID를 받아 진짜 장소 목록을 긁어오는 함수
async function fetchNaverMapList(listId: string): Promise<any[]> {
  try {
    // 네이버 지도 공개 리스트를 가져오는 실제 Open API 주소 문맥
    const apiUrl = `https://map.naver.com/v5/api/bookmark/share/${listId}`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    
    // 네이버 데이터 구조에서 필요한 장소 정보만 매핑
    // (네이버 API 응답 구조에 따라 일부 명칭은 다를 수 있으나 가장 표준적인 명칭 기준)
    const items = data.bookmarkList?.transforms || [];
    return items.map((item: any) => ({
      name: item.name,
      category: item.displayCategory || '장소',
      address: item.address,
      naverUrl: `https://map.naver.com/v5/entry/place/${item.id}`
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { links } = await req.json();

    if (!links || !Array.isArray(links) || links.length < 2) {
      return NextResponse.json({ error: '최소 2개 이상의 링크가 필요합니다.' }, { status: 400 });
    }

    // 1단계: 모든 단축 URL을 원본 주소로 변환
    const resolvedUrls = await Promise.all(links.map(link => resolveRedirect(link.trim())));

    // 2단계: 주소에서 네이버 리스트 고유 ID(bookmarkListId) 추출
    // 예: https://map.naver.com/.../bookmark?bookmarkListId=123456
    const listIds = resolvedUrls.map(url => {
      const match = url.match(/bookmarkListId=([A-Za-z0-9_-]+)/);
      return match ? match[1] : null;
    });

    if (listIds.some(id => !id)) {
      return NextResponse.json({ error: '올바른 네이버 지도 공유 리스트 링크가 아닙니다.' }, { status: 400 });
    }

    // 3단계: 각각의 리스트 ID에서 장소 데이터 긁어오기
    const allListsResults = await Promise.all(listIds.map(id => fetchNaverMapList(id!)));

    // 4단계: 두 리스트의 '교집합(공통 장소)' 추출 (이름 기준)
    const firstList = allListsResults[0];
    const restLists = allListsResults.slice(1);

    const commonPlaces = firstList.filter(placeA => 
      restLists.every(subList => 
        subList.some((placeB: any) => placeB.name === placeA.name)
      )
    );

    // 5단계: 일치율 계산 (전체 대비 교집합 비율 또는 유동적 계산)
    const totalUniqueCount = new Set([...firstList, ...allListsResults.flat()].map(p => p.name)).size;
    const matchRate = totalUniqueCount > 0 ? Math.round((commonPlaces.length / totalUniqueCount) * 100) : 0;

    return NextResponse.json({
      success: true,
      matchRate: matchRate || 0,
      places: commonPlaces // 이제 진짜 겹치는 장소만 리스트로 나감!
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}