import React from 'react';
import { Composition } from 'remotion';
import { Hero } from './Hero';
import { Answer } from './Answer';
import { Tune } from './Tune';
import './fonts';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="hero" component={Hero} durationInFrames={240} fps={30} width={640} height={1059} />
      <Composition id="answer" component={Answer} durationInFrames={270} fps={30} width={640} height={1391} />
      <Composition id="tune" component={Tune} durationInFrames={340} fps={30} width={640} height={1391} />
    </>
  );
};
