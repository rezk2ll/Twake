import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';

import DownloadAppBanner from './index';

export default {
  title: 'molecules/DownloadAppBanner',
  component: DownloadAppBanner,
} as ComponentMeta<typeof DownloadAppBanner>;

const Template: ComponentStory<typeof DownloadAppBanner> = args => <DownloadAppBanner {...args} />;

export const Primary = Template.bind({});

Primary.args = {
  download: () => {},
  onBannerClose: () => {},
};
