const fs = require("fs");
const path = require("path");

const frontendRoot = path.resolve(__dirname, "../..");

test("the Android development profile produces an installable DiscountMate development client", () => {
  const easConfigPath = path.join(frontendRoot, "eas.json");

  expect(fs.existsSync(easConfigPath)).toBe(true);

  const easConfig = JSON.parse(fs.readFileSync(easConfigPath, "utf8"));
  const appConfig = require(path.join(frontendRoot, "app.json"));
  const packageJson = require(path.join(frontendRoot, "package.json"));

  expect(appConfig.expo.android.package).toBe("com.discountmate.app");
  expect(easConfig.build.development).toEqual(
    expect.objectContaining({
      developmentClient: true,
      distribution: "internal",
      android: expect.objectContaining({ buildType: "apk" }),
    }),
  );
  expect(packageJson.dependencies["expo-dev-client"]).toEqual(expect.any(String));
});

test("the frontend is linked to the existing team-owned Expo project", () => {
  const appConfig = require(path.join(frontendRoot, "app.json"));

  expect(appConfig.expo.owner).toBe("discountmateapps-team");
  expect(appConfig.expo.slug).toBe("discountmate");
  expect(appConfig.expo.extra?.eas?.projectId).toBe(
    "b79970a1-ad9d-4898-839f-1c24a90912a5",
  );
});
