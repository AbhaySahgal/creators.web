import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, TrendingUp, Star, Users, Eye, Compass } from '../../components/icons';
import { Layout } from '../../components/layout/Layout';
import { CreatorCard } from '../../components/ui/CreatorCard';
import { PostCard } from '../../components/ui/PostCard';
import { mockCreators } from '../../data/users';
import type { Creator } from '../../types';
import { useContent } from '../../context/ContentContext';
import { useLiveStream } from '../../context/LiveStreamContext';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../../context/WsContext';
import { creatorsApi } from '../../services/creatorsApi';
import {
	creatorSummaryToCardCreator,
	creatorTopDtoToCardCreator,
	creatorTopRowToCardCreator,
	dedupeCreatorsByUserId,
	hydrateCreatorCardsFromHttp,
} from '../../services/creatorWsMap';
import { creatorWsTopPrimary } from '../../services/creatorWsService';
import type { CreatorTopResponse } from '../../services/creatorWsTypes';
import { useDragScroll } from '../../hooks/useDragScroll';
import { normalizeHashtagTag, textHasHashtag } from '../../utils/hashtag';

const CATEGORIES = ['All', 'Fitness', 'Art', 'Tech', 'Travel', 'Music', 'Food', 'Gaming'];

export function Explore() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { state: contentState, loadMoreExplore, creatorWsSearch, creatorWsTop } = useContent();
	const explorePosts = useMemo(
		() =>
			contentState.explorePostIds
				.map(pid => contentState.posts.find(p => p.id === pid))
				.filter((p): p is NonNullable<typeof p> => Boolean(p)),
		[contentState.explorePostIds, contentState.posts]
	);
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [category, setCategory] = useState('All');
	const [sortBy, setSortBy] = useState<'popular' | 'new' | 'price'>('popular');
	const tagFilter = normalizeHashtagTag(searchParams.get('tag') ?? '');
	const [wsCreators, setWsCreators] = useState<Creator[]>([]);
	const [topCreators, setTopCreators] = useState<Creator[]>([]);
	const [topCursor, setTopCursor] = useState<string | null>(null);
	const [topLoading, setTopLoading] = useState(false);
	const [isCuratedTop, setIsCuratedTop] = useState(false);
	const wsCreatorsRef = useRef<Creator[]>([]);
	useEffect(() => {
		wsCreatorsRef.current = wsCreators;
	}, [wsCreators]);
	const [wsDirCursor, setWsDirCursor] = useState<string | null>(null);
	const [wsDirLoading, setWsDirLoading] = useState(false);
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureWsAuth = useEnsureWsAuth();
	const { getLiveStreams } = useLiveStream();
	const liveStreams = getLiveStreams();
	const liveRef = useDragScroll();
	const trendingRef = useDragScroll();
	const allRef = useDragScroll();

	const showTrending = !debouncedSearch && category === 'All';

	useEffect(() => {
		const t = window.setTimeout(() => {
			setDebouncedSearch(search.trim());
		}, 350);
		return () => { window.clearTimeout(t); };
	}, [search]);

	useEffect(() => {
		if (contentState.postsWsStatus !== 'ready') return;
		const ac = new AbortController();
		let cancelled = false;
		setWsDirLoading(true);
		const cat = category === 'All' ? undefined : category;
		const q = debouncedSearch.trim() || undefined;
		void creatorWsSearch({ q, category: cat, limit: 30 })
			.then(r => {
				if (cancelled) return null;
				const base = dedupeCreatorsByUserId(
					r.creators.map(d => creatorSummaryToCardCreator(d, mockCreators[0]))
				);
				setWsCreators(base);
				setWsDirCursor(r.nextCursor ?? null);
				return hydrateCreatorCardsFromHttp(base, ac.signal);
			})
			.then(merged => {
				if (merged == null || cancelled || ac.signal.aborted) return;
				setWsCreators(dedupeCreatorsByUserId(merged));
			})
			.catch(() => {
				if (cancelled) return;
				setWsCreators([]);
				setWsDirCursor(null);
			})
			.finally(() => {
				if (!cancelled) setWsDirLoading(false);
			});

		return () => {
			cancelled = true;
			ac.abort();
		};
	}, [contentState.postsWsStatus, debouncedSearch, category, creatorWsSearch]);

	const loadRankedTrending = useCallback((cursor?: string, append = false) => {
		setTopLoading(true);
		const applyTop = (r: CreatorTopResponse) => {
			const mapped = r.creators.map(d => creatorTopDtoToCardCreator(d, mockCreators[0]));
			setIsCuratedTop(false);
			setTopCreators(prev => append ? [...prev, ...mapped] : mapped);
			setTopCursor(r.nextCursor ?? null);
		};

		return creatorWsTop({ limit: 10, cursor })
			.then(applyTop)
			.catch(() =>
				creatorsApi.creators.top({ limit: 10, cursor })
					.then(applyTop)
					.catch(() => {
						if (!append) {
							setTopCreators([]);
							setTopCursor(null);
						}
					})
			)
			.finally(() => setTopLoading(false));
	}, [creatorWsTop]);

	const loadTrending = useCallback((cursor?: string, append = false) => {
		if (contentState.postsWsStatus !== 'ready' || !showTrending) return;

		if (isCuratedTop && cursor && wsConnected && wsAuthReady) {
			setTopLoading(true);
			void ensureWsAuth()
				.then(() => creatorWsTopPrimary(ws, { limit: 10, cursor }))
				.then(r => {
					const rows = (r.creators ?? []).map(d => creatorTopRowToCardCreator(d, mockCreators[0]));
					setTopCreators(prev => append ? [...prev, ...rows] : rows);
					setTopCursor(r.nextCursor ?? null);
				})
				.catch(() => {
					if (!append) {
						setTopCreators([]);
						setTopCursor(null);
					}
				})
				.finally(() => setTopLoading(false));
			return;
		}

		if (!isCuratedTop || cursor) {
			void loadRankedTrending(cursor, append);
		}
	}, [
		contentState.postsWsStatus,
		showTrending,
		isCuratedTop,
		wsConnected,
		wsAuthReady,
		ensureWsAuth,
		ws,
		loadRankedTrending,
	]);

	useEffect(() => {
		if (!showTrending) {
			setTopCreators([]);
			setTopCursor(null);
			setIsCuratedTop(false);
			return;
		}
		if (contentState.postsWsStatus !== 'ready') return;

		if (wsConnected && wsAuthReady) {
			setTopLoading(true);
			void ensureWsAuth()
				.then(() => creatorWsTopPrimary(ws, { limit: 10 }))
				.then(r => {
					const rows = (r.creators ?? []).map(d => creatorTopRowToCardCreator(d, mockCreators[0]));
					if (rows.length > 0) {
						setIsCuratedTop(true);
						setTopCreators(rows);
						setTopCursor(r.nextCursor ?? null);
						setTopLoading(false);
						return;
					}
					setIsCuratedTop(false);
					return loadRankedTrending(undefined, false);
				})
				.catch(() => {
					setIsCuratedTop(false);
					return loadRankedTrending(undefined, false);
				});
			return;
		}

		void loadRankedTrending(undefined, false);
	}, [
		showTrending,
		contentState.postsWsStatus,
		wsConnected,
		wsAuthReady,
		ensureWsAuth,
		ws,
		loadRankedTrending,
	]);

	function loadMoreDirectory() {
		if (!wsDirCursor || contentState.postsWsStatus !== 'ready') return;
		const ac = new AbortController();
		const cat = category === 'All' ? undefined : category;
		const q = debouncedSearch.trim() || undefined;
		void creatorWsSearch({ q, category: cat, limit: 30, cursor: wsDirCursor })
			.then(r => {
				const nextRows = r.creators.map(d => creatorSummaryToCardCreator(d, mockCreators[0]));
				const prev = wsCreatorsRef.current;
				const seen: Record<string, true> = {};
				for (const c of prev) seen[c.id] = true;
				const add = nextRows.filter(c => !seen[c.id]);
				setWsCreators(dedupeCreatorsByUserId([...prev, ...add]));
				setWsDirCursor(r.nextCursor ?? null);
				if (!add.length) return null;
				return hydrateCreatorCardsFromHttp(add, ac.signal).then(mergedAdds => {
					if (ac.signal.aborted) return;
					setWsCreators(cur => {
						const byId: Record<string, Creator> = {};
						for (const c of mergedAdds) byId[c.id] = c;
						return dedupeCreatorsByUserId(cur.map(c => byId[c.id] ?? c));
					});
				});
			})
			.catch(() => {});
	}

	function loadMoreTrending() {
		if (!topCursor) return;
		loadTrending(topCursor, true);
	}

	const filtered = useMemo(() => {
		return [...wsCreators].sort((a, b) => {
			if (sortBy === 'popular') {
				const pa = a.followerCount || a.subscriberCount;
				const pb = b.followerCount || b.subscriberCount;
				return pb - pa;
			}
			if (sortBy === 'new') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			return a.subscriptionPrice - b.subscriptionPrice;
		});
	}, [wsCreators, sortBy]);

	const filteredExplorePosts = useMemo(() => {
		if (!tagFilter) return explorePosts;
		return explorePosts.filter(p => textHasHashtag(p.text ?? '', tagFilter));
	}, [explorePosts, tagFilter]);

	const trendingCreators =
		topCreators.length > 0 ? topCreators : wsCreators.slice(0, 3);

	return (
		<Layout>
			<div className="max-w-6xl mx-auto px-4 py-6">
				<div className="mb-6">
					<div className="relative mb-4">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
						<input
							value={search}
							onChange={e => setSearch(e.target.value)}
							placeholder="Search creators by name, category..."
							className="w-full bg-input border border-border/20 rounded-2xl pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-border/40 transition-colors"
						/>
					</div>

					<div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
						{CATEGORIES.map(cat => (
							<button
								key={cat}
								onClick={() => setCategory(cat)}
								className={`shrink-0 text-sm px-3 py-1.5 rounded-xl font-medium transition-all ${
									category === cat ? 'bg-rose-500 text-white' : 'bg-foreground/5 text-muted hover:text-foreground hover:bg-foreground/10'
								}`}
							>
								{cat}
							</button>
						))}
					</div>
				</div>

				<div className="mb-8 space-y-4">
					<div className="flex items-center gap-2">
						<Compass className="w-4 h-4 text-rose-400" />
						<h2 className="font-semibold text-foreground text-sm">Discover posts</h2>
					</div>
					{tagFilter && (
						<div className="flex items-center justify-between gap-3 bg-surface border border-border/20 rounded-2xl px-4 py-2">
							<p className="text-xs text-muted">
								Showing posts tagged <span className="text-rose-400 font-semibold">#{tagFilter}</span>
							</p>
							<button
								type="button"
								onClick={() => {
									const next = new URLSearchParams(searchParams);
									next.delete('tag');
									setSearchParams(next, { replace: true });
								}}
								className="text-xs font-semibold text-muted hover:text-foreground"
							>
								Clear
							</button>
						</div>
					)}
					{contentState.postsWsStatus === 'connecting' && (
						<p className="text-xs text-muted">Loading posts…</p>
					)}
					{contentState.postsWsStatus === 'error' && contentState.postsWsError && (
						<p className="text-xs text-rose-400">{contentState.postsWsError}</p>
					)}
					<div className="space-y-4">
						{filteredExplorePosts.map(post => (
							<PostCard key={post.id} post={post} />
						))}
					</div>
					{contentState.exploreNextCursor ? (
						<button
							type="button"
							onClick={() => { void loadMoreExplore(); }}
							className="text-sm font-medium text-rose-400 hover:text-rose-300"
						>
							Load more posts
						</button>
					) : null}
				</div>

				{showTrending && liveStreams.length > 0 && (
					<div className="mb-8">
						<div className="flex items-center gap-2 mb-4">
							<h2 className="font-semibold text-foreground text-sm">Live Now</h2>
						</div>
						<div ref={liveRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 mb-8">
							{liveStreams.map(stream => (
								<button
									key={stream.id}
									onClick={() => { void navigate(`/live/${stream.id}`); }}
									className="relative bg-surface border border-border/20 rounded-2xl overflow-hidden hover:border-border/30 transition-all group flex-shrink-0 w-64 sm:w-72"
								>
									<div className="relative h-28">
										<img src={stream.creatorAvatar} alt={stream.creatorName} className="w-full h-full object-cover scale-105 blur-sm brightness-50" />
										<div className="absolute inset-0 bg-gradient-to-b from-transparent to-overlay/60" />
										<div className="absolute top-2 left-2 flex items-center gap-1.5 bg-rose-500 rounded-lg px-2 py-0.5">
											<div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
											<span className="text-white text-[10px] font-bold">LIVE</span>
										</div>
										<div className="absolute top-2 right-2 flex items-center gap-1 bg-background/70 text-foreground dark:bg-overlay/50 dark:text-white rounded-lg px-2 py-0.5 backdrop-blur-sm">
											<Eye className="w-3 h-3 text-muted dark:text-white/70" />
											<span className="text-foreground dark:text-white text-[10px] font-semibold">{stream.viewerCount.toLocaleString()}</span>
										</div>
										<div className="px-3 py-2.5">
											<p className="text-muted dark:text-white/70 text-xs truncate">{stream.title}</p>
										</div>
									</div>
								</button>
							))}
						</div>
					</div>
				)}

				{showTrending && (
					<div className="mb-8">
						<div className="flex items-center gap-2 mb-4">
							<TrendingUp className="w-4 h-4 text-rose-400" />
							<h2 className="font-semibold text-foreground text-sm">
								{isCuratedTop ? 'Top Creators' : 'Trending Now'}
							</h2>
							{topLoading && <span className="text-xs text-muted">Loading…</span>}
						</div>
						{trendingCreators.length > 0 ? (
							<>
								<div ref={trendingRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
									{trendingCreators.map((creator, idx) => (
										<div key={`${creator.id}-${creator.rank ?? idx}`} className="relative flex-shrink-0 w-56 sm:w-64 md:w-72">
											{(isCuratedTop ? idx < 3 : creator.rank === 1) && (
												<div className="absolute -top-2 -right-2 z-10 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
													<Star className="w-2.5 h-2.5 fill-white" />
													#{isCuratedTop ? idx + 1 : creator.rank}
													{isCuratedTop ? ' Top' : ' Trending'}
												</div>
											)}
											<CreatorCard creator={creator} />
										</div>
									))}
								</div>
								{topCursor && topCreators.length > 0 ? (
									<div className="mt-3 text-center">
										<button
											type="button"
											onClick={() => { loadMoreTrending(); }}
											disabled={topLoading}
											className="text-sm font-medium text-rose-400 hover:text-rose-300 disabled:opacity-50"
										>
											Load more {isCuratedTop ? 'top' : 'trending'}
										</button>
									</div>
								) : null}
							</>
						) : !topLoading ? (
							<p className="text-xs text-muted">No trending creators right now.</p>
						) : null}
					</div>
				)}

				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-1.5 text-muted text-sm">
						<Users className="w-4 h-4" />
						<span>
							{wsDirLoading ? '…' : filtered.length} creator{filtered.length !== 1 ? 's' : ''}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<SlidersHorizontal className="w-4 h-4 text-muted" />
						<select
							value={sortBy}
							onChange={e => setSortBy(e.target.value as typeof sortBy)}
							className="bg-input border border-border/20 rounded-xl px-2 py-1.5 text-xs text-foreground/80 focus:outline-none"
						>
							<option value="popular">Most Popular</option>
							<option value="new">Newest</option>
							<option value="price">Lowest Price</option>
						</select>
					</div>
				</div>

				{filtered.length === 0 ? (
					<div className="text-center py-16">
						<Search className="w-10 h-10 text-muted/50 mx-auto mb-3" />
						<p className="text-muted">No creators found</p>
					</div>
				) : (
					<div ref={allRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
						{filtered.map(creator => (
							<div key={creator.id} className="flex-shrink-0 w-48 sm:w-56 md:w-64">
								<CreatorCard creator={creator} />
							</div>
						))}
					</div>
				)}

				{wsDirCursor ? (
					<div className="mt-4 text-center">
						<button
							type="button"
							onClick={() => { loadMoreDirectory(); }}
							className="text-sm font-medium text-rose-400 hover:text-rose-300"
						>
							Load more creators
						</button>
					</div>
				) : null}
			</div>
		</Layout>
	);
}
