const { Guild, TextChannel, User } = require('discord.js');
const Moe = require('@structures/Client');
const { Player } = require('shoukaku');
const { EventEmitter } = require('events');

class Dispatcher extends EventEmitter {
  /**
   *
   * @param {Moe} client
   * @param {Guild} guild
   * @param {TextChannel} channel
   * @param {Player} player
   * @param {User} user
   */
  constructor(client, guild, channel, player, user) {
    super();
    /**
     * @type {Moe}
     */
    this.client = client;
    /**
     * @type {Guild}
     */
    this.guild = guild;
    /**
     * @type {TextChannel}
     */
    this.channel = channel;
    /**
     * @type {Player}
     */
    this.player = player;
    /**
     * @type {Array<import('shoukaku').Track>}
     */
    this.queue = [];
    /**
     * @type {boolean}
     */
    this.stopped = false;
    /**
     * @type {import('shoukaku').Track}
     */
    this.current = null;
    /**
     * @type {'off'|'repeat'|'queue'}
     */
    this.loop = 'off';
    /**
     * @type {import('shoukaku').Track[]}
     */
    this.matchedTracks = [];
    /**
     * @type {User}
     */
    this.requester = user;

    this.player
      .on('start', (data) =>
        this.manager.emit('trackStart', this.player, this.current, this.channel, this.matchedTracks, this, data),
      )
      .on('end', (data) => {
        if (!this.queue.length) this.manager.emit('queueEnd', this.player, this.current, this.channel, this, data);
        this.manager.emit('trackEnd', this.player, this.current, this.channel, this, data);
      })
      .on('stuck', (data) =>
        this.manager.emit('trackStuck', this.player, this.current, data),
      )
      .on('error', (...arr) => {
        this.manager.emit('trackError', this.player, this.current, ...arr);
        this._errorHandler(...arr);
      })
      .on('closed', (...arr) => {
        this.manager.emit('socketClosed', this.player, ...arr);
        this._errorHandler(...arr);
      });
  }

  get manager() {
    return this.client.manager;
  }

  /**
   *
   * @param {Error} data
   */
  _errorHandler(data) {
    if (data instanceof Error || data instanceof Object) {
      this.client.logger.error(data);
    }
    this.queue.length = 0;
    this.destroy('error');
  }

  get exists() {
    return this.manager.players.has(this.guild.id);
  }

  async play() {
    if (!this.exists || (!this.queue.length && !this.current)) {
      this.destroy();
      return;
    }
    this.current = this.queue.length !== 0 ? this.queue.shift() : this.queue[0];
    if (this.matchedTracks.length !== 0) this.matchedTracks = [];
    const search = await this.manager.search(`ytsearch:${this.current.info.title}`);
    this.matchedTracks.push(...search.tracks.slice(0, 11));
    this.player.playTrack({ track: this.current.track });
  }

  destroy() {
    this.queue.length = 0;
    this.player.connection.disconnect();
    this.manager.players.delete(this.guild.id);
    if (this.stopped) return;
    this.manager.emit('playerDestroy', this.player);
  }

  /**
   *
   * @param {import('shoukaku').Track} providedTrack
   * @returns {string}
   */
  displayThumbnail(providedTrack) {
    const track = providedTrack || this.current;
    return track.info.uri.includes('youtube')
      ? `https://img.youtube.com/vi/${track.info.identifier}/hqdefault.jpg`
      : null;
  }

  async check() {
    if (this.queue.length && !this.current && !this.player.paused) {
      this.play();
    }
  }
}

module.exports = Dispatcher;
