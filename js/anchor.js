/*!
 * QUELORA – Real-time interaction platform for websites
 * 
 * @author German Zelaya
 * @version 1.0.0
 * @since 2023
 Licensed under the GNU Affero General Public License v3.0
 * 
 * Copyright (C) 2025 German Zelaya
 * 
 * QUELORA is an open-source platform designed to add real-time comments,
 * posts, and reactions to websites. Its lightweight widget (~170KB uncompressed)
 * integrates easily into any page without the need for frameworks like React
 * or jQuery. It includes support for AI-powered automated moderation,
 * engagement analytics, and a multi-tenant dashboard to manage multiple sites
 * from a single interface.
 * 
 * This script is part of the QUELORA project, available at:
 * https://www.quelora.org/
 * 
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


/**
 * Module for generating anchor links based on provided data.
 * @module AnchorModule
 */
const AnchorModule = (function () {
  /**
   * Generates a formatted link based on the input data type and IDs.
   * @param {Object} data - Data containing type and IDs for link generation.
   * @param {string} data.type - Type of link ('mention', 'follower', 'reply', 'comment', 'like').
   * @param {Object} data.ids - Object containing relevant IDs.
   * @param {string} [data.ids.entity] - Entity ID for comments, replies, or likes.
   * @param {string} [data.ids.commentId] - Comment ID for comments, replies, or likes.
   * @param {string} [data.ids.replyId] - Reply ID for replies or likes.
   * @param {string} [data.ids.follow] - Follow ID for follower links.
   * @param {string} [data.ids.mention] - Mention ID for mention links.
   * @returns {string} Formatted link or '#' if invalid data.
   */
  function generateLink(data) {
    const { entity, commentId, replyId, follow, mention } = data.ids;
    switch (data.type) {
      case 'mention':
        return mention ? `#QUELORA-R-${mention}` : '#';
      case 'follower':
        return follow ? `#QUELORA-U-${follow}` : '#';
      case 'reply':
        return entity && commentId && replyId
          ? `#QUELORA-Q-${entity}-${commentId}-${replyId}`
          : '#';
      case 'comment':
        return entity && commentId ? `#QUELORA-Q-${entity}-${commentId}` : '#';
      case 'like':
        return entity && commentId
          ? replyId
            ? `#QUELORA-L-${entity}-${commentId}-${replyId}`
            : `#QUELORA-L-${entity}-${commentId}`
          : '#';
      default:
        return '#';
    }
  }

  return { generateLink };
})();

export default AnchorModule;