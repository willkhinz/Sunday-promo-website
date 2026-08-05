import React from 'react';
import { Composition } from 'remotion';
import { Hero } from './Hero';
import { Answer } from './Answer';
import { Tune } from './Tune';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="hero" component={Hero} durationInFrames={255} fps={30} width={640} height={1058} />
      <Composition id="answer" component={Answer} durationInFrames={285} fps={30} width={640} height={1390} />
      <Composition id="tune" component={Tune} durationInFrames={180} fps={30} width={640} height={1390} />
    </>
  );
};
