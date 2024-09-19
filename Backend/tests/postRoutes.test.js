const request = require("supertest");
const mongoose = require("mongoose");
const app = require("./index.test"); // Use the test version of the app
const Post = require("../models/Post");
const User = require("../models/User");

// Increase Jest timeout (30 seconds)
jest.setTimeout(30000);

// Test Users and Posts
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

const posts = {
  validPost1: {
    title: "Valid Post 1",
    description: "This is a valid post 1.",
  },
  validPost2: {
    title: "Valid Post 2",
    description: "This is a valid post 2.",
  },
};

// Before running tests, connect to the test database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// After each test, clear the users and posts collection
afterEach(async () => {
  await User.deleteMany({});
  await Post.deleteMany({});
});

// After all tests are done, disconnect from the test database
afterAll(async () => {
  await mongoose.connection.dropDatabase(); // Drop the test database to ensure it's clean
  await mongoose.connection.close();
});

describe("Post API Tests", () => {
  let tokenUser1, tokenUser2, tokenAdmin;
  let postId1, postId2;
  let userId1, userId2, adminUserId;

  // Before each test, create normal users and an admin
  beforeEach(async () => {
    // Create Normal User 1 and get token
    const signupResUser1 = await request(app)
      .post("/api/users/signup")
      .send(users.normalUser1);
    userId1 = signupResUser1.body.userId;
    const loginResUser1 = await request(app).post("/api/users/signin").send({
      useremail: users.normalUser1.useremail,
      password: users.normalUser1.password,
    });
    tokenUser1 = loginResUser1.body.token;

    // Create Normal User 2 and get token
    const signupResUser2 = await request(app)
      .post("/api/users/signup")
      .send(users.normalUser2);
    userId2 = signupResUser2.body.userId;
    const loginResUser2 = await request(app).post("/api/users/signin").send({
      useremail: users.normalUser2.useremail,
      password: users.normalUser2.password,
    });
    tokenUser2 = loginResUser2.body.token;

    // Create Admin User and get token
    const signupResAdmin = await request(app)
      .post("/api/users/signup")
      .send(users.adminUser);
    adminUserId = signupResAdmin.body.userId;
    const loginResAdmin = await request(app).post("/api/users/signin").send({
      useremail: users.adminUser.useremail,
      password: users.adminUser.password,
    });
    tokenAdmin = loginResAdmin.body.token;

    // Create Post for Normal User 1
    const createPostRes1 = await request(app)
      .post("/api/posts/")
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(posts.validPost1);
    postId1 = createPostRes1.body._id;

    // Create Post for Normal User 2
    const createPostRes2 = await request(app)
      .post("/api/posts/")
      .set("Authorization", `Bearer ${tokenUser2}`)
      .send(posts.validPost2);
    postId2 = createPostRes2.body._id;
  });

  /**
   * ====================
   * Create Post Test Cases
   * ====================
   */
  it("should create a post successfully", async () => {
    const newPost = {
      title: "New Post",
      description: "This is a new post",
    };

    const res = await request(app)
      .post("/api/posts/")
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(newPost);

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("_id");
    expect(res.body.title).toBe(newPost.title);
  });

  it("should fail to create a post without token", async () => {
    const newPost = {
      title: "New Post Without Token",
      description: "This post shouldn't be created",
    };

    const res = await request(app).post("/api/posts/").send(newPost);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to create a post with missing fields", async () => {
    const res = await request(app)
      .post("/api/posts/")
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send({
        title: "", // Empty title
        description: "This is a valid description",
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.errors[0].msg).toBe("Title is required");
  });

  /**
   * ====================
   * Like/Dislike Post Test Cases
   * ====================
   */
  it("should like a post successfully", async () => {
    const res = await request(app)
      .post(`/api/posts/${postId1}/like`)
      .set("Authorization", `Bearer ${tokenUser2}`); // User2 likes User1's post

    expect(res.statusCode).toEqual(200);
    expect(res.body.likes).toBe(1);
    expect(res.body.likedBy).toContain(userId2);
  });

  it("should fail to like a post without token", async () => {
    const res = await request(app).post(`/api/posts/${postId1}/like`);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to like a post already liked", async () => {
    // First like the post
    await request(app)
      .post(`/api/posts/${postId1}/like`)
      .set("Authorization", `Bearer ${tokenUser2}`);

    // Try to like the same post again
    const res = await request(app)
      .post(`/api/posts/${postId1}/like`)
      .set("Authorization", `Bearer ${tokenUser2}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty(
      "message",
      "You have already liked this post"
    );
  });

  it("should dislike a post successfully", async () => {
    const res = await request(app)
      .post(`/api/posts/${postId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser2}`); // User2 dislikes User1's post

    expect(res.statusCode).toEqual(200);
    expect(res.body.dislikes).toBe(1);
    expect(res.body.dislikedBy).toContain(userId2);
  });

  it("should fail to dislike a post without token", async () => {
    const res = await request(app).post(`/api/posts/${postId1}/dislike`);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to dislike a post already disliked", async () => {
    // First dislike the post
    await request(app)
      .post(`/api/posts/${postId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser2}`);

    // Try to dislike the same post again
    const res = await request(app)
      .post(`/api/posts/${postId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser2}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty(
      "message",
      "You have already disliked this post"
    );
  });

  /**
   * ====================
   * Update Post Test Cases
   * ====================
   */
  it("should update a post successfully", async () => {
    const updatedPost = {
      title: "Updated Title",
      description: "Updated description",
    };

    const res = await request(app)
      .put(`/api/posts/${postId1}`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(updatedPost);

    expect(res.statusCode).toEqual(200);
    expect(res.body.title).toBe(updatedPost.title);
    expect(res.body.description).toBe(updatedPost.description);
  });

  it("should not allow a user to update another user's post", async () => {
    const res = await request(app)
      .put(`/api/posts/${postId1}`)
      .set("Authorization", `Bearer ${tokenUser2}`) // Trying to update User1's post with User2's token
      .send({ title: "Attempted Update" });

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty("message", "Unauthorized action");
  });

  /**
   * ====================
   * Delete Post Test Cases
   * ====================
   */
  it("should allow a user to delete their own post", async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId1}`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("message", "Post deleted successfully");
  });

  it("should not allow a user to delete another user's post", async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId1}`)
      .set("Authorization", `Bearer ${tokenUser2}`); // Trying to delete User1's post with User2's token

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty("message", "Unauthorized action");
  });

  it("should allow an admin to delete any post", async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId1}`)
      .set("Authorization", `Bearer ${tokenAdmin}`); // Admin deletes User1's post

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("message", "Post deleted successfully");
  });
});
