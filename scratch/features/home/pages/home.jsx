import React, { useState, useEffect, useRef } from 'react';
import { Select, DatePicker, Button, Spin } from 'antd';
import { MoreOutlined, EyeOutlined, BoxPlotOutlined, GiftOutlined, UserOutlined, PlusOutlined, ArrowUpOutlined, ArrowRightOutlined, TrophyOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Link } from 'react-router-dom';
import { MapPin, Target, BarChart2, Zap, Coins } from 'lucide-react';
import { compaignApi } from '../../compaign/api/compaign';
import { useDispatch } from 'react-redux';
import { auth } from '../../../firebase'; 
import { useMerchantCreditsQuery } from '../../auth/api/auth';
import { useGetMyEventsQuery, useGetMyCoinRushEventsQuery } from '../../events/api/eventsApi';
import { useGetDashboardEventStatsQuery, useGetDashboardPeakActivityQuery } from '../../dashboard/api/dashboardApi';


export default function Home() {
  const dispatch = useDispatch();
  useMerchantCreditsQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: eventsData, isLoading: isEventsLoading } = useGetMyEventsQuery();
  const { data: coinRushData, isLoading: isCoinRushLoading } = useGetMyCoinRushEventsQuery();
  const { data: eventStatsData, isLoading: isEventStatsLoading } = useGetDashboardEventStatsQuery();
  const { data: peakActivityResp, isLoading: isPeakActivityLoading } = useGetDashboardPeakActivityQuery();

  const activeEvents = eventsData?.events?.filter(e => e.status !== 'cancelled') || [];
  const activeCoinRushEvents = coinRushData?.events?.filter(e => e.status !== 'cancelled') || [];

  const combinedEvents = React.useMemo(() => {
    const list = [
      ...activeEvents.map(e => ({ ...e, typeLabel: 'RAIDR EVENT', isCoinRush: false })),
      ...activeCoinRushEvents.map(e => ({ ...e, typeLabel: `COIN RUSH (${e.eventType === 'GPS' ? 'OUTDOOR' : 'INDOOR'})`, isCoinRush: true }))
    ];
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  }, [activeEvents, activeCoinRushEvents]);

  const totalActiveXP = React.useMemo(() => {
    const normalXP = activeEvents.reduce((sum, e) => sum + (parseInt(e.xpReward) || 0), 0);
    const coinRushXP = activeCoinRushEvents.reduce((sum, e) => sum + (parseInt(e.xpReward) || 0), 0);
    return normalXP + coinRushXP;
  }, [activeEvents, activeCoinRushEvents]);

  const totalCheckpoints = React.useMemo(() => {
    return activeCoinRushEvents.reduce((sum, e) => sum + (parseInt(e.checkpointCount) || e.checkpoints?.length || 0), 0);
  }, [activeCoinRushEvents]);

  const eventsChartData = React.useMemo(() => {
    const now = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      let count = 0;
      if (eventsData?.events) {
        eventsData.events.forEach(ev => {
          const evDate = new Date(ev.createdAt);
          if (evDate.getDate() === d.getDate() && evDate.getMonth() === d.getMonth() && evDate.getFullYear() === d.getFullYear()) {
            count++;
          }
        });
      }
      if (coinRushData?.events) {
        coinRushData.events.forEach(ev => {
          const evDate = new Date(ev.createdAt);
          if (evDate.getDate() === d.getDate() && evDate.getMonth() === d.getMonth() && evDate.getFullYear() === d.getFullYear()) {
            count++;
          }
        });
      }
      data.push({ name, value: count });
    }
    return data;
  }, [eventsData, coinRushData]);

  const claimsChartData = React.useMemo(() => {
    const now = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      let count = 0;
      if (eventsData?.events) {
        eventsData.events.forEach(ev => {
          if (ev.claims) {
            ev.claims.forEach(c => {
              const claimDate = new Date(c.claimedAt);
              if (claimDate.getDate() === d.getDate() && claimDate.getMonth() === d.getMonth() && claimDate.getFullYear() === d.getFullYear()) {
                count++;
              }
            });
          }
        });
      }
      if (coinRushData?.events) {
        coinRushData.events.forEach(ev => {
          if (ev.claims) {
            ev.claims.forEach(c => {
              const claimDate = new Date(c.claimedAt);
              if (claimDate.getDate() === d.getDate() && claimDate.getMonth() === d.getMonth() && claimDate.getFullYear() === d.getFullYear()) {
                count++;
              }
            });
          }
        });
      }
      data.push({ name, value: count });
    }
    return data;
  }, [eventsData, coinRushData]);

  const eventBreakdownData = React.useMemo(() => {
    const raidrCount = activeEvents.length;
    const gpsCount = activeCoinRushEvents.filter(e => e.eventType === 'GPS').length;
    const qrCount = activeCoinRushEvents.filter(e => e.eventType === 'QR').length;
    
    const total = raidrCount + gpsCount + qrCount;
    if (total === 0) {
      return [{ name: 'No Active Events', value: 1, color: '#E5E7EB', percent: 0 }];
    }
    
    return [
      { name: 'RAIDR Events', value: raidrCount, color: '#8B5CF6', percent: Math.round((raidrCount / total) * 100) },
      { name: 'Coin Rush (Outdoor)', value: gpsCount, color: '#3B82F6', percent: Math.round((gpsCount / total) * 100) },
      { name: 'Coin Rush (Indoor)', value: qrCount, color: '#EC4899', percent: Math.round((qrCount / total) * 100) }
    ].filter(item => item.value > 0);
  }, [activeEvents, activeCoinRushEvents]);

  const peakActivityData = React.useMemo(() => {
    if (peakActivityResp && peakActivityResp.length > 0) {
      return peakActivityResp.map(item => ({ hour: item.time, scans: item.scans }));
    }
    return [
      { hour: '08:00', scans: 0 },
      { hour: '10:00', scans: 0 },
      { hour: '12:00', scans: 0 },
      { hour: '14:00', scans: 0 },
      { hour: '16:00', scans: 0 },
      { hour: '18:00', scans: 0 },
      { hour: '20:00', scans: 0 },
      { hour: '22:00', scans: 0 },
    ];
  }, [peakActivityResp]);

  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [totalAds, setTotalAds] = useState(0);
  const [adsIncrease, setAdsIncrease] = useState(0);
  const [dateRangeStr, setDateRangeStr] = useState('vs. last 7 days');
  const [totalImpressions, setTotalImpressions] = useState(0);
  const [totalBoxOpens, setTotalBoxOpens] = useState(0);
  const [totalRewardClaims, setTotalRewardClaims] = useState(0);
  const [impressionsChartData, setImpressionsChartData] = useState([]);
  const [rewardChartData, setRewardChartData] = useState([]);
  const [totalRewardsOffered, setTotalRewardsOffered] = useState(0);

  useEffect(() => {
    const storedUser = localStorage.getItem('merchantUser');
    if (storedUser) {
      try {
        const userObj = JSON.parse(storedUser);
        if (userObj.name) {
          // Get first name
          setUserName(userObj.name.split(' ')[0]);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const data = await dispatch(compaignApi.endpoints.getCampaigns.initiate()).unwrap();

        // Fetch impression logs for all campaigns
        const impressionsPromises = data.map(campaign =>
          dispatch(compaignApi.endpoints.getCampaignImpressions.initiate(campaign.id))
            .unwrap()
            .catch(() => []) // Fallback to empty array if endpoint fails or doesn't exist
        );
        const allImpressionsArrs = await Promise.all(impressionsPromises);
        const allImpressions = allImpressionsArrs.flat();

        const active = data
          .filter(doc => doc.isActive !== false)
          .map(doc => ({
            id: doc.id,
            name: doc.adTitle || 'Unnamed Campaign',
            status: 'Active',
            impressions: doc.impressions || 0,
            boxes: doc.boxOpens || 0,
            claims: doc.rewardClaims || 0,
            image: doc.imageUrl || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=100&h=100&fit=crop',
            latitude: parseFloat(doc.latitude) || 0,
            longitude: parseFloat(doc.longitude) || 0,
            adCategory: doc.adCategory,
            radius: doc.radius || 0
          }));

        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        const fourteenDaysAgo = new Date(now);
        fourteenDaysAgo.setDate(now.getDate() - 14);

        let currentPeriodAds = 0;
        let previousPeriodAds = 0;
        let tempImpressions = 0;
        let tempBoxOpens = 0;
        let tempRewardClaims = 0;
        const rewardBreakdown = {};

        const last7DaysData = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          last7DaysData.push({ name, value: 0, dateObj: d });
        }

        // Aggregate impression logs for chart
        allImpressions.forEach(imp => {
          if (imp.viewedAt) {
            const viewedDate = imp.viewedAt.toDate ? imp.viewedAt.toDate() :
              (typeof imp.viewedAt === 'string' ? new Date(imp.viewedAt) :
                new Date(imp.viewedAt.seconds * 1000));

            if (!isNaN(viewedDate)) {
              const dayMatch = last7DaysData.find(item =>
                item.dateObj.getDate() === viewedDate.getDate() &&
                item.dateObj.getMonth() === viewedDate.getMonth() &&
                item.dateObj.getFullYear() === viewedDate.getFullYear()
              );
              if (dayMatch) {
                dayMatch.value += 1;
              }
            }
          }
        });

        data.forEach(doc => {
          tempImpressions += doc.impressions || 0;
          tempBoxOpens += doc.boxOpens || 0;
          tempRewardClaims += doc.rewardClaims || 0;

          if (doc.mysteryBoxReward && doc.mysteryBoxReward.trim() !== '') {
            const rewardName = doc.mysteryBoxReward.trim().toLowerCase();
            const capitalizedReward = rewardName.charAt(0).toUpperCase() + rewardName.slice(1);
            if (!rewardBreakdown[capitalizedReward]) {
              rewardBreakdown[capitalizedReward] = 0;
            }
            rewardBreakdown[capitalizedReward] += 1;
          }

          if (doc.createdAt) {
            const createdDate = doc.createdAt.toDate ? doc.createdAt.toDate() : new Date(doc.createdAt.seconds * 1000);

            if (createdDate >= sevenDaysAgo) {
              currentPeriodAds++;
            } else if (createdDate >= fourteenDaysAgo && createdDate < sevenDaysAgo) {
              previousPeriodAds++;
            }
          }
        });

        let increasePct = 0;
        if (previousPeriodAds === 0) {
          increasePct = currentPeriodAds > 0 ? 100 : 0;
        } else {
          increasePct = ((currentPeriodAds - previousPeriodAds) / previousPeriodAds) * 100;
        }

        setAdsIncrease(increasePct);

        let dateRangeStr = '';
        if (sevenDaysAgo && now) {
          dateRangeStr = `vs. ${fourteenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sevenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
        setDateRangeStr(dateRangeStr);

        setTotalAds(data.length);
        setTotalImpressions(tempImpressions);
        setTotalBoxOpens(tempBoxOpens);
        setTotalRewardClaims(tempRewardClaims);

        setImpressionsChartData(last7DaysData.map(({ name, value }) => ({ name, value })));

        const totalAdsWithRewards = Object.values(rewardBreakdown).reduce((a, b) => a + b, 0);
        setTotalRewardsOffered(totalAdsWithRewards);

        const pieColors = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
        let sortedRewards = Object.entries(rewardBreakdown).sort((a, b) => b[1] - a[1]);

        let finalRewardData = sortedRewards.slice(0, 4).map(([name, value], i) => ({
          name: name.length > 15 ? name.substring(0, 15) + '...' : name,
          value: value,
          percent: totalAdsWithRewards > 0 ? Math.round((value / totalAdsWithRewards) * 100) : 0,
          color: pieColors[i % pieColors.length]
        }));

        if (sortedRewards.length > 4) {
          const otherValue = sortedRewards.slice(4).reduce((sum, [_, val]) => sum + val, 0);
          finalRewardData.push({
            name: 'Other',
            value: otherValue,
            percent: totalAdsWithRewards > 0 ? Math.round((otherValue / totalAdsWithRewards) * 100) : 0,
            color: pieColors[4]
          });
        }

        if (finalRewardData.length === 0) {
          finalRewardData = [{ name: 'No Rewards', value: 1, percent: 0, color: '#E5E7EB' }];
        }

        setRewardChartData(finalRewardData);
        setActiveCampaigns(active.slice(0, 4));
      } catch (error) {
        console.error("Failed to fetch campaigns", error);
      }
      setLoading(false);
    };

    fetchHomeData();
  }, [dispatch]);

  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || activeCampaigns.length === 0) return;

    const initMap = () => {
      // Center on the first campaign, or default to a global view if coords are 0
      const centerPos = activeCampaigns[0]?.latitude
        ? { lat: activeCampaigns[0].latitude, lng: activeCampaigns[0].longitude }
        : { lat: 39.8283, lng: -98.5795 };

      const map = new window.google.maps.Map(mapRef.current, {
        center: centerPos,
        zoom: 3,
        mapTypeControl: false,
        streetViewControl: false,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
        ]
      });

      const bounds = new window.google.maps.LatLngBounds();
      let hasValidMarkers = false;

      activeCampaigns.forEach((campaign, i) => {
        if (!campaign.latitude || !campaign.longitude) return;
        hasValidMarkers = true;

        const position = { lat: campaign.latitude, lng: campaign.longitude };
        bounds.extend(position);

        const customMarkerSvg = `data:image/svg+xml;charset=UTF-8,` + encodeURIComponent(`
          <svg width="60" height="90" viewBox="0 0 60 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#38BDF8" />
                <stop offset="100%" stop-color="#A855F7" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <line x1="30" y1="45" x2="30" y2="75" stroke="#A855F7" stroke-width="3" />
            <circle cx="30" cy="75" r="6" fill="#A855F7" stroke="white" stroke-width="3" />
            <circle cx="30" cy="28" r="24" fill="url(#grad)" stroke="white" stroke-width="2" filter="url(#glow)"/>
            <path d="M21 24h18v11h-18zM21 20h18v3h-18zM30 20v15" stroke="white" stroke-width="2" stroke-linejoin="round" fill="none"/>
            <path d="M30 20c-2-2-6-1-6 1.5s4 2.5 6 0c2-2 6-1 6 1.5s-4 2.5-6 0z" stroke="white" stroke-width="2" fill="none"/>
          </svg>
        `);

        new window.google.maps.Marker({
          position,
          map,
          title: campaign.name,
          icon: {
            url: customMarkerSvg,
            scaledSize: new window.google.maps.Size(40, 60),
            anchor: new window.google.maps.Point(20, 60)
          }
        });

        if (campaign.adCategory === 'geo campaign' && campaign.radius) {
          new window.google.maps.Circle({
            strokeColor: "#8B5CF6", // purple matching theme
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#8B5CF6",
            fillOpacity: 0.2,
            map,
            center: position,
            radius: campaign.radius * 1000,
          });
        }
      });

      if (hasValidMarkers) {
        map.fitBounds(bounds);
        // Don't zoom in too far if only one marker
        const listener = window.google.maps.event.addListener(map, "idle", () => {
          if (map.getZoom() > 12) map.setZoom(12);
          window.google.maps.event.removeListener(listener);
        });
      }
    };

    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }
  }, [activeCampaigns]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back{userName ? `, ${userName}` : ''}! 👋</h1>
          {/* <p className="text-gray-500">Here's what's happening with your campaigns.</p> */}
          <p className="text-gray-500">Here's what's happening with your events.</p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Live Raidr Events', desc: 'Total number of active standard events', value: eventStatsData?.liveRaidrEvents !== undefined ? eventStatsData.liveRaidrEvents.toLocaleString() : activeEvents.length.toLocaleString(), icon: <TrophyOutlined className="text-purple-600 text-xl" />, bg: 'bg-purple-100', color: 'text-purple-600' },
          { title: 'Live Coin Rush Events', desc: 'Total number of active coin rush events', value: eventStatsData?.liveCoinRushEvents !== undefined ? eventStatsData.liveCoinRushEvents.toLocaleString() : activeCoinRushEvents.length.toLocaleString(), icon: <Zap className="text-blue-500 text-xl" />, bg: 'bg-blue-100', color: 'text-blue-500' },
          { title: 'Completion Rate', desc: 'Percentage of players completing events', value: eventStatsData?.completionRate !== undefined ? `${eventStatsData.completionRate}%` : '0%', icon: <GiftOutlined className="text-green-500 text-xl" />, bg: 'bg-green-100', color: 'text-green-500' },
          { title: 'Coin Rush Checkpoints', desc: 'Total checkpoints in active coin rushes', value: eventStatsData?.coinRushCheckpoints !== undefined ? eventStatsData.coinRushCheckpoints.toLocaleString() : totalCheckpoints.toLocaleString(), icon: <MapPin className="text-orange-500 text-xl" />, bg: 'bg-orange-100', color: 'text-orange-500' },
        ].map((metric, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metric.bg} z-10`}>
                {metric.icon}
              </div>
            </div>
            <div className="z-10 relative">
              <h3 className="text-gray-500 text-sm font-medium mb-1">{metric.title}</h3>
              <p className="text-xs text-gray-400 mb-2">{metric.desc}</p>
              <p className="text-3xl font-bold text-gray-900 mb-3">{metric.value}</p>
            </div>
            {metric.increase && (
              <div className="mt-auto flex items-center gap-2 z-10 relative">
                <span className={`flex items-center text-xs font-semibold ${metric.increaseVal >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'} px-2 py-1 rounded-full`}>
                  <ArrowUpOutlined className={`text-[10px] mr-1 ${metric.increaseVal >= 0 ? '' : 'rotate-180'}`} /> {metric.increase.replace('+ ', '').replace('- ', '')}
                </span>
                <span className="text-gray-400 text-xs">{metric.dateStr}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Chart 1: Events Created Over Time */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">Events Created Over Time</h3>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eventsChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#E5E7EB', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Line type="monotone" dataKey="value" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#8B5CF6', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Event Claims Over Time */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">Reward Claims Over Time</h3>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={claimsChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#E5E7EB', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#10B981', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Active Events Breakdown */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">Active Events Breakdown</h3>
          </div>
          <div className="relative flex-1 flex items-center justify-center">
            <div className="h-[220px] w-full flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie
                    data={eventBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {eventBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute left-[25%] top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <span className="block text-2xl font-bold text-gray-900">
                  {activeEvents.length + activeCoinRushEvents.length}
                </span>
                <span className="block text-xs text-gray-500">Active</span>
              </div>
              <div className="w-[50%] flex flex-col justify-center gap-3 pl-4">
                {eventBreakdownData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm text-gray-600 truncate max-w-[120px]" title={item.name}>{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{item.value} ({item.percent}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chart 4: Peak Activity Hours */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">Peak Activity Hours (Check-ins)</h3>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakActivityData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="scans" fill="#f97316" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Responsive Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

        {/* 1. Active Campaigns */}
        {/*
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">Your Active Campaigns</h3>

          </div>
          <div className="flex-1 space-y-4">
            {loading ? (
              <div className="flex justify-center py-8"><Spin /></div>
            ) : activeCampaigns.length > 0 ? (
              activeCampaigns.map((campaign) => (
                <Link to={`/campaigns/${campaign.id}`} key={campaign.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition cursor-pointer">
                  <div className="flex items-center gap-4">
                    <img src={campaign.image} alt={campaign.name} className="w-14 h-14 rounded-xl object-cover" />
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm mb-1">{campaign.name}</h4>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
                        <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'Active' ? 'bg-green-500' : 'bg-gray-300'}`}></span> {campaign.status}</span>
                        <span className="flex items-center gap-1"><EyeOutlined /> {campaign.impressions}</span>
                        <span className="flex items-center gap-1"><BoxPlotOutlined /> {campaign.boxes}</span>
                        <span className="flex items-center gap-1"><GiftOutlined /> {campaign.claims}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">No active campaigns found.</div>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-50">
            <Link to="/campaigns" className="text-purple-600 font-semibold text-sm flex items-center gap-1 hover:text-purple-700 transition">
              View all campaigns <ArrowRightOutlined />
            </Link>
          </div>
        </div>
        */}

        {/* 2. Campaigns Map */}
        {/*
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-full min-h-[500px]">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Campaigns Map</h3>
          <div className="flex-1 rounded-2xl bg-gray-100 overflow-hidden relative" ref={mapRef}>
          </div>
        </div>
        */}

        {/* 3. Live Events */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-full lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">Your Live Events & Coin Rushes</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {(isEventsLoading || isCoinRushLoading) ? (
              <div className="flex justify-center py-8 col-span-full"><Spin /></div>
            ) : combinedEvents.length > 0 ? (
              combinedEvents.map((event) => (
                <Link to={event.isCoinRush ? `/events/${event.id}?coinRush=true` : `/events/${event.id}`} key={event.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl border border-gray-100 transition cursor-pointer shadow-sm hover:shadow-md hover:border-gray-200">
                    {event.imageUrl ? (
                        <img src={event.imageUrl} alt={event.title} className="w-16 h-16 rounded-xl object-cover shadow-sm" />
                    ) : (
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center border transition-all ${
                          event.isCoinRush 
                            ? 'bg-amber-50 border-amber-100 text-amber-500' 
                            : 'bg-purple-50 border-purple-100 text-purple-500'
                        }`}>
                            {event.isCoinRush ? <Coins className="w-8 h-8" /> : <Target className="w-8 h-8" />}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-gray-900 text-base mb-1 truncate">{event.title}</h4>
                        <span className={`text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase border ${
                          event.isCoinRush 
                            ? event.eventType === 'GPS' 
                              ? 'bg-amber-50 text-amber-600 border-amber-100'
                              : 'bg-blue-50 text-blue-600 border-blue-100'
                            : 'bg-purple-50 text-purple-600 border-purple-100'
                        }`}>
                          {event.typeLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-medium mt-2">
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100">
                          <span className={`w-1.5 h-1.5 rounded-full ${event.status === 'live' || event.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span> 
                          {(event.status || 'unknown').toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1 text-orange-500"><TrophyOutlined /> {event.xpReward} XP</span>
                        {event.isCoinRush ? (
                          <span className="flex items-center gap-1 text-blue-500"><MapPin size={12} /> {event.checkpointCount || event.checkpoints?.length || 0} Checkpoints</span>
                        ) : (
                          <span className="flex items-center gap-1 text-blue-500"><GiftOutlined /> {event.remainingQty} left</span>
                        )}
                      </div>
                    </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm col-span-full">No active events or coin rushes found.</div>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center">
            <span className="text-xs text-gray-400">Showing up to 4 recent events</span>
            <Link to="/events" className="text-purple-600 font-semibold text-sm flex items-center gap-1 hover:text-purple-700 transition">
              View all events <ArrowRightOutlined />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
