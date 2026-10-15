import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '유럽겨울여행 | 우리의 계절, 함께 떠나는 유럽', description: '50~60대 여성을 위한 유럽 여행 동아리. 1월·2월의 겨울과 8월의 여름, 같은 속도로 걷는 여행 친구를 만나세요.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
