const request = require("supertest");
const mongoose = require("mongoose");
const app = require("./index.test"); // Use the test version of the app
const User = require("../models/User"); // Assuming your user model is in ../models/User

// Increase Jest timeout (30 seconds)
jest.setTimeout(30000);

// Test Users
const users = {
  normalUser1: {
    useremail: "normal1@example.com",
    password: "password123",
    user_fname: "Normal",
    user_lname: "UserOne",
    address: "123 Street One",
    phone_number: "1111111111",
    admin: false,
  },
  normalUser2: {
    useremail: "normal2@example.com",
    password: "password123",
    user_fname: "Normal",
    user_lname: "UserTwo",
    address: "123 Street Two",
    phone_number: "2222222222",
    admin: false,
  },
  normalUser3: {
    useremail: "normal3@example.com",
    password: "password123",
    user_fname: "Normal",
    user_lname: "UserThree",
    address: "123 Street Three",
    phone_number: "3333333333",
    admin: false,
  },
  adminUser: {
    useremail: "admin@example.com",
    password: "admin123",
    user_fname: "Admin",
    user_lname: "User",
    address: "Admin Street",
    phone_number: "9999999999",
    admin: true,
  },
};

// Before running tests, connect to the test database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// After each test, clear the users collection
afterEach(async () => {
  await User.deleteMany({});
});

// After all tests are done, disconnect from the test database
afterAll(async () => {
  await mongoose.connection.dropDatabase(); // Drop the test database to ensure it's clean
  await mongoose.connection.close();
});

describe("User API Tests", () => {
  let tokenUser1, tokenUser2, tokenAdmin;
  let userId1, userId2, userId3;

  // Before each test, create 3 normal users and 1 admin
  beforeEach(async () => {
    // Create Normal User 1 and store userId
    const signupResUser1 = await request(app)
      .post("/api/users/signup")
      .send(users.normalUser1);
    userId1 = signupResUser1.body.userId; // Save userId for later use
    const loginResUser1 = await request(app).post("/api/users/signin").send({
      useremail: users.normalUser1.useremail,
      password: users.normalUser1.password,
    });
    tokenUser1 = loginResUser1.body.token;

    // Create Normal User 2 and store userId
    const signupResUser2 = await request(app)
      .post("/api/users/signup")
      .send(users.normalUser2);
    userId2 = signupResUser2.body.userId;
    const loginResUser2 = await request(app).post("/api/users/signin").send({
      useremail: users.normalUser2.useremail,
      password: users.normalUser2.password,
    });
    tokenUser2 = loginResUser2.body.token;

    // Create Normal User 3 and store userId (for deletion tests)
    const signupResUser3 = await request(app)
      .post("/api/users/signup")
      .send(users.normalUser3);
    userId3 = signupResUser3.body.userId;

    // Create Admin User and store userId
    const signupResAdmin = await request(app)
      .post("/api/users/signup")
      .send(users.adminUser);
    const loginResAdmin = await request(app).post("/api/users/signin").send({
      useremail: users.adminUser.useremail,
      password: users.adminUser.password,
    });
    tokenAdmin = loginResAdmin.body.token;
  });

  /**
   * ====================
   * Signup Test Cases
   * ====================
   */
  it("should sign up a new user successfully", async () => {
    const newUser = {
      useremail: "newuser@example.com",
      password: "newpassword123",
      user_fname: "New",
      user_lname: "User",
      address: "New Street",
      phone_number: "4444444444",
      admin: false,
    };

    const res = await request(app).post("/api/users/signup").send(newUser);
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("userId");
  });

  it("should fail to sign up with duplicate email", async () => {
    const res = await request(app)
      .post("/api/users/signup")
      .send(users.normalUser1);
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty("message", "Email already in use");
  });

  it("should fail to sign up with missing required fields", async () => {
    const res = await request(app).post("/api/users/signup").send({
      useremail: "",
      password: "password123",
    });
    expect(res.statusCode).toEqual(400);
  });

  /**
   * ====================
   * Signin Test Cases
   * ====================
   */
  it("should sign in a user with valid credentials", async () => {
    const res = await request(app).post("/api/users/signin").send({
      useremail: users.normalUser1.useremail,
      password: users.normalUser1.password,
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("token");
  });

  it("should fail to sign in a user with invalid credentials", async () => {
    const res = await request(app).post("/api/users/signin").send({
      useremail: users.normalUser1.useremail,
      password: "wrongpassword",
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty("message", "Invalid credentials");
  });

  it("should fail to sign in a non-existent user", async () => {
    const res = await request(app)
      .post("/api/users/signin")
      .send({ useremail: "nonexistent@example.com", password: "password123" });
    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "User not found");
  });

  /**
   * ====================
   * Profile Test Cases
   * ====================
   */
  it("should fetch a user's own profile", async () => {
    const res = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${tokenUser1}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("email", users.normalUser1.useremail);
  });

  it("should fail to fetch profile without token", async () => {
    const res = await request(app).get("/api/users/profile");
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  /**
   * ====================
   * Update Test Cases
   * ====================
   */
  it("should update a user's own profile", async () => {
    const res = await request(app)
      .put(`/api/users/${userId1}`) // Use userId instead of email
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send({
        user_fname: "UpdatedFirstName",
        user_lname: "UpdatedLastName",
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body.user.user_fname).toEqual("UpdatedFirstName");
    expect(res.body.user.user_lname).toEqual("UpdatedLastName");
  });

  it("should not allow a user to update another user's profile", async () => {
    const res = await request(app)
      .put(`/api/users/${userId1}`) // Trying to update User 1's profile with User 2's token
      .set("Authorization", `Bearer ${tokenUser2}`)
      .send({
        user_fname: "AttemptedUpdate",
      });
    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty(
      "message",
      "Access denied: Not authorized to perform this action."
    );
  });

  /**
   * ====================
   * Delete Test Cases
   * ====================
   */
  it("should allow a user to delete their own account", async () => {
    const res = await request(app)
      .delete(`/api/users/${userId1}`) // Use userId instead of email
      .set("Authorization", `Bearer ${tokenUser1}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("message", "User deleted successfully");
  });

  it("should not allow a normal user to delete another user's account", async () => {
    const res = await request(app)
      .delete(`/api/users/${userId1}`) // Trying to delete User 1's account with User 2's token
      .set("Authorization", `Bearer ${tokenUser2}`);
    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty("message", "Access denied, admin only");
  });

  it("should allow an admin to delete another user's account", async () => {
    const res = await request(app)
      .delete(`/api/users/${userId1}`) // Admin deleting User 1's account
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("message", "User deleted successfully");
  });
});
