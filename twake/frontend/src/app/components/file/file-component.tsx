import React, { useState, useEffect } from 'react';
import classNames, { Argument } from 'classnames';

import { FileThumbnail, FileDetails, FileActions, FileProgress } from './parts';
import {
  isPendingFileStatusCancel,
  isPendingFileStatusError,
  isPendingFileStatusSuccess,
} from 'app/features/files/utils/pending-files';
import { DataFileType } from './types';
import DriveService from 'app/deprecated/Apps/Drive/Drive.js';
import FileUploadService from '../../features/files/services/file-upload-service';
import RouterService from 'app/features/router/services/router-service';

import './file.scss';
import { PendingFileRecoilType } from 'app/features/files/types/file';
import Api from 'app/features/global/framework/api-service';
import FileUploadAPIClient from '../../features/files/api/file-upload-api-client';

type PropsType = {
  source: 'internal' | 'drive' | string;
  externalId: string | any;
  file: DataFileType;
  context: 'input' | 'message' | 'drive';
  progress?: number;
  status?: PendingFileRecoilType['status'];
  onRemove?: Function;
  className?: string;
  large?: boolean;
};

export default ({
  source,
  externalId,
  file: _file,
  className,
  context,
  progress,
  status,
  onRemove,
  large,
}: PropsType) => {
  const { companyId, workspaceId } = RouterService.getStateFromRoute();
  const [file, setFile] = useState<DataFileType>(_file);
  const classNameArguments: Argument[] = [
    'file-component',
    className,
    { 'large-view': large },
    {
      'file-component-error':
        status && (isPendingFileStatusError(status) || isPendingFileStatusCancel(status)),
      'file-component-uploading': progress != undefined && progress < 1,
    },
  ];

  useEffect(() => {
    if (source === 'drive') {
      (async () => {
        if (typeof externalId === 'string') {
          externalId = { id: externalId, workspace_id: workspaceId };
        }

        let driveFile = (await Api.post('/ajax/drive/v2/find', {
          options: {
            element_id: externalId?.id,
            workspace_id: externalId?.workspace_id,
          },
        })) as any;
        driveFile = driveFile?.data || {};

        setFile({
          ...file,
          thumbnail: driveFile.preview_link,
          name: driveFile.name,
          size: driveFile.size,
          type: FileUploadAPIClient.mimeToType(
            FileUploadAPIClient.extensionToMime(driveFile.extension),
          ),
        });
      })();
    } else {
      setFile(_file);
    }
  }, [_file]);

  const onClickFile = async () => {
    if (source === 'internal') {
      //Only if upload has ended
      if ((!status || isPendingFileStatusSuccess(status)) && file.id)
        DriveService.viewDocument(
          {
            id: file.id,
            name: file.name,
            url: FileUploadService.getDownloadRoute({
              companyId: companyId || '',
              fileId: file.id,
            }),
            extension: file.name.split('.').pop(),
          },
          true,
        );
    }
    if (source === 'drive') {
      if (typeof externalId === 'string') {
        externalId = { id: externalId, workspace_id: workspaceId };
      }

      const file = (await Api.post('/ajax/drive/v2/find', {
        options: {
          element_id: externalId?.id,
          workspace_id: externalId?.workspace_id,
        },
      })) as any;
      DriveService.viewDocument(file?.data, context === 'input');
    }
  };

  const computedWidth = file.thumbnail_ratio * 200;

  return (
    <div
      className={classNames(classNameArguments)}
      style={large ? { width: computedWidth } : {}}
      onClick={() => companyId && onClickFile()}
    >
      {large && (
        <div
          className="file-large-preview"
          style={{
            backgroundImage:
              'url(' +
              FileUploadService.getDownloadRoute({
                companyId: companyId || '',
                fileId: file.id,
              }) +
              ')',
          }}
        ></div>
      )}
      <div className="file-info-container">
        <FileThumbnail file={file} />
        <FileDetails file={file} source={source} />
        <FileActions
          deletable={context === 'input'}
          actionMenu={context === 'message' && source === 'internal'}
          status={status}
          file={file}
          onRemove={onRemove}
          source={source}
        />
      </div>
      <FileProgress progress={progress} status={status} file={file} />
    </div>
  );
};
