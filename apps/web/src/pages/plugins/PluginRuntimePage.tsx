import { useParams } from 'react-router-dom';
import TicketRuntimePage from './ticket/TicketRuntimePage';
import EventsRuntimePage from './events/EventsRuntimePage';
import RaffleRuntimePage from './raffle/RaffleRuntimePage';
import PollsRuntimePage from './polls/PollsRuntimePage';
import QuestsRuntimePage from './quests/QuestsRuntimePage';
import AnnouncerRuntimePage from './announcer/AnnouncerRuntimePage';
import AntiSpamRuntimePage from './anti-spam/AntiSpamRuntimePage';

export default function PluginRuntimePage() {
  const { id: pluginId } = useParams<{ id: string }>();

  if (pluginId === 'ticket') return <TicketRuntimePage />;
  if (pluginId === 'events') return <EventsRuntimePage />;
  if (pluginId === 'raffle') return <RaffleRuntimePage />;
  if (pluginId === 'polls') return <PollsRuntimePage />;
  if (pluginId === 'quests') return <QuestsRuntimePage />;
  if (pluginId === 'announcer') return <AnnouncerRuntimePage />;
  if (pluginId === 'anti-spam') return <AntiSpamRuntimePage />;

  return (
    <div className="card text-sm text-gray-600">
      当前插件暂无专用业务页，请使用配置页。
    </div>
  );
}
