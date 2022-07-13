import { useChannelFileList } from 'app/features/channels/hooks/use-channel-media-files';
import React from 'react';
import ChannelAttachment from './channel-attachment';
import { LoadingAttachements, NoAttachements } from './commun';
import PerfectScrollbar from 'react-perfect-scrollbar';

type PropsType = {
  maxItems?: number;
};

export default ({ maxItems }: PropsType): React.ReactElement => {
  const { loading, result, loadMore } = useChannelFileList();

  if (loading) return <LoadingAttachements />;

  if (result.length === 0 && !loading) return <NoAttachements />;

  return (
    <PerfectScrollbar
      className="-mb-4 py-3 overflow-hidden -mx-2 px-2"
      style={{ maxHeight: 'calc(80vh - 100px)', minHeight: 'calc(80vh - 100px)' }}
      options={{ suppressScrollX: true, suppressScrollY: false }}
      component="div"
      onYReachEnd={() => loadMore()}
    >
      {result.slice(0, maxItems || result.length).map(file => (
        <ChannelAttachment key={file.id} file={file} is_media={false} />
      ))}
    </PerfectScrollbar>
  );
};
