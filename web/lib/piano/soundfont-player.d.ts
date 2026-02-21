/**
 * Minimal type declarations for the `soundfont-player` package.
 * @see https://github.com/danigb/soundfont-player
 */
declare module "soundfont-player" {
  interface PlayOptions {
    gain?: number;
    duration?: number;
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
    adsr?: [number, number, number, number];
    loop?: boolean;
  }

  interface PlayingNode {
    stop(time?: number): void;
  }

  interface Player {
    name: string;
    play(
      note: string | number,
      time?: number,
      options?: PlayOptions,
    ): PlayingNode;
    stop(time?: number): void;
    connect(destination: AudioNode): Player;
  }

  interface InstrumentOptions {
    soundfont?: "MusyngKite" | "FluidR3_GM";
    format?: "mp3" | "ogg";
    nameToUrl?: (name: string, sf: string, format: string) => string;
    destination?: AudioNode;
    gain?: number;
    notes?: (string | number)[];
    only?: (string | number)[];
    isSoundfontURL?: (name: string) => boolean;
  }

  function instrument(
    ac: AudioContext,
    name: string,
    options?: InstrumentOptions,
  ): Promise<Player>;

  function nameToUrl(name: string, sf?: string, format?: string): string;

  export { instrument, nameToUrl, Player, PlayingNode, PlayOptions, InstrumentOptions };
  export default { instrument, nameToUrl } as {
    instrument: typeof instrument;
    nameToUrl: typeof nameToUrl;
  };
}
