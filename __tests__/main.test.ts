import {Plugin} from "../src/plugin";

test("Builds plugin", async () => {
  const plugin = new Plugin("/var/www/html/ips/plugins/notificationtoast");
  const hooks = plugin.getHooks();
  expect(hooks).toEqual([{}]);
});
