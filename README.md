# grid-wolf

`grid-wolf` is a project meant primarily to demonstrate design and development patterns associated
with the [AWS Well-Architected Framework](./packages/docs/aws-well-architected.md).

The `grid-wolf` application provides UIs, APIs, code and infrastructure for managing encounters and
combat in table-top roleplaying games. A gamemaster can upload map images, grid configuration and
other encounter information to the application, and can invite and manage participating players.
Players can upload avatar/token images and character data.  Players and gamemaster can then move
characters and NPCs around the map, view lines-of-site and areas-of-effect, and manage encounter
progress and statistics, all in real-time.

Unlike similar tools such as those provided by Roll20, `grid-wolf` does not attempt to provide
resources for map creation or video conferencing amongst participants.

This application is in early development. Refer to
[architecture documentation](./packages/docs/architecture.md) for more information.