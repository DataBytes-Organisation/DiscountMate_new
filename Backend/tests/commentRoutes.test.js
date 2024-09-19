const request = require("supertest");
const mongoose = require("mongoose");
const app = require("./index.test"); // Use the test version of the app
const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");

// Increase Jest timeout (30 seconds)
jest.setTimeout(30000);

// Test Users, Posts, and Comments
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
};

const comments = {
  validComment1: {
    comment: "This is a valid comment.",
  },
  updatedComment: {
    comment: "This is an updated comment.",
  },
};

// Before running tests, connect to the test database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// After each test, clear the users, posts, and comments collection
afterEach(async () => {
  await User.deleteMany({});
  await Post.deleteMany({});
  await Comment.deleteMany({});
});

// After all tests are done, disconnect from the test database
afterAll(async () => {
  await mongoose.connection.dropDatabase(); // Drop the test database to ensure it's clean
  await mongoose.connection.close();
});

describe("Comment API Tests", () => {
  let tokenUser1, tokenUser2, tokenAdmin;
  let postId1;
  let userId1, userId2, adminUserId;
  let commentId1;

  // Before each test, create normal users, an admin, and a post
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

    // Create Comment for Post by Normal User 1
    const createCommentRes1 = await request(app)
      .post(`/api/comments/post/${postId1}/comment`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(comments.validComment1);
    commentId1 = createCommentRes1.body._id;
  });

  /**
   * ====================
   * Add Comment Test Cases
   * ====================
   */
  it("should add a comment successfully", async () => {
    const res = await request(app)
      .post(`/api/comments/post/${postId1}/comment`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(comments.validComment1);

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("_id");
    expect(res.body.comment).toBe(comments.validComment1.comment);
  });

  it("should fail to add a comment without token", async () => {
    const res = await request(app)
      .post(`/api/comments/post/${postId1}/comment`)
      .send(comments.validComment1);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to add a comment with missing comment field", async () => {
    const res = await request(app)
      .post(`/api/comments/post/${postId1}/comment`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send({ comment: "" });

    expect(res.statusCode).toEqual(400);
    expect(res.body.errors[0].msg).toBe("Comment text is required");
  });

  /**
   * ====================
   * Get All Comments Test Cases
   * ====================
   */
  it("should get all comments for a post with populated user details and replies", async () => {
    const res = await request(app)
      .get(`/api/comments/post/${postId1}/comments`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBeGreaterThan(0);

    // Verify that user details are populated for the first comment
    const comment = res.body[0];
    expect(comment).toHaveProperty("user.user_fname");
    expect(comment).toHaveProperty("user.user_lname");

    // Verify that replies are fetched and user details of replies are populated
    if (comment.replies && comment.replies.length > 0) {
      const reply = comment.replies[0];
      expect(reply).toHaveProperty("user.user_fname");
      expect(reply).toHaveProperty("user.user_lname");
    }
  });

  it("should fail to get comments without token", async () => {
    const res = await request(app).get(
      `/api/comments/post/${postId1}/comments`
    );

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  /**
   * ====================
   * Get Single Comment Test Cases
   * ====================
   */
  it("should get a single comment successfully with populated replies", async () => {
    const res = await request(app)
      .get(`/api/comments/comment/${commentId1}`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body._id).toBe(commentId1);
    expect(res.body).toHaveProperty("user.user_fname");
    expect(res.body).toHaveProperty("user.user_lname");

    // Verify that replies are fetched and user details of replies are populated
    if (res.body.replies && res.body.replies.length > 0) {
      const reply = res.body.replies[0];
      expect(reply).toHaveProperty("user.user_fname");
      expect(reply).toHaveProperty("user.user_lname");
    }
  });

  it("should fail to get a single comment without token", async () => {
    const res = await request(app).get(`/api/comments/comment/${commentId1}`);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to get a comment that does not exist", async () => {
    const nonExistentCommentId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .get(`/api/comments/comment/${nonExistentCommentId}`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Comment not found");
  });

  /**
   * ====================
   * Update Comment Test Cases
   * ====================
   */
  it("should update a comment successfully", async () => {
    const res = await request(app)
      .put(`/api/comments/comment/${commentId1}`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(comments.updatedComment);

    expect(res.statusCode).toEqual(200);
    expect(res.body.updatedComment.comment).toBe(
      comments.updatedComment.comment
    );
  });

  it("should not allow a user to update another user's comment", async () => {
    const res = await request(app)
      .put(`/api/comments/comment/${commentId1}`)
      .set("Authorization", `Bearer ${tokenUser2}`)
      .send(comments.updatedComment);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty("message", "Unauthorized action");
  });

  /**
   * ====================
   * Delete Comment Test Cases
   * ====================
   */
  it("should allow a user to delete their own comment", async () => {
    const res = await request(app)
      .delete(`/api/comments/comment/${commentId1}`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("message", "Comment deleted successfully");
  });

  it("should not allow a user to delete another user's comment", async () => {
    const res = await request(app)
      .delete(`/api/comments/comment/${commentId1}`)
      .set("Authorization", `Bearer ${tokenUser2}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty("message", "Unauthorized action");
  });

  it("should allow an admin to delete any comment", async () => {
    const res = await request(app)
      .delete(`/api/comments/comment/${commentId1}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("message", "Comment deleted successfully");
  });
  /**
   * ====================
   * Like/Unlike/Dislike/Undislike Comment Test Cases
   * ====================
   */

  // 6. Like a Comment (PUT /comment/:commentId/like)

  it("should like a comment successfully with a valid token", async () => {
    const res = await request(app)
      .put(`/api/comments/comment/${commentId1}/like`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.likes).toBe(1);
  });

  it("should fail to like a comment without a token", async () => {
    const res = await request(app).put(
      `/api/comments/comment/${commentId1}/like`
    );

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to like a comment that is already liked by the user", async () => {
    await request(app)
      .put(`/api/comments/comment/${commentId1}/like`)
      .set("Authorization", `Bearer ${tokenUser1}`); // First like

    const res = await request(app)
      .put(`/api/comments/comment/${commentId1}/like`)
      .set("Authorization", `Bearer ${tokenUser1}`); // Try to like again

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty(
      "message",
      "You have already liked this comment"
    );
  });

  it("should fail to like a comment with an invalid or non-existent comment ID", async () => {
    const nonExistentCommentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/comments/comment/${nonExistentCommentId}/like`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Comment not found");
  });

  // 7. Unlike a Comment (PUT /comment/:commentId/unlike)

  it("should unlike a comment successfully with a valid token", async () => {
    await request(app)
      .put(`/api/comments/comment/${commentId1}/like`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    const res = await request(app)
      .put(`/api/comments/comment/${commentId1}/unlike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.likes).toBe(0);
  });

  it("should fail to unlike a comment without a token", async () => {
    const res = await request(app).put(
      `/api/comments/comment/${commentId1}/unlike`
    );

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to unlike a comment that hasn't been liked by the user", async () => {
    const res = await request(app)
      .put(`/api/comments/comment/${commentId1}/unlike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty(
      "message",
      "You haven't liked this comment"
    );
  });

  it("should fail to unlike a comment with an invalid or non-existent comment ID", async () => {
    const nonExistentCommentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/comments/comment/${nonExistentCommentId}/unlike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Comment not found");
  });

  // 8. Dislike a Comment (PUT /comment/:commentId/dislike)

  it("should dislike a comment successfully with a valid token", async () => {
    const res = await request(app)
      .put(`/api/comments/comment/${commentId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.dislikes).toBe(1);
  });

  it("should fail to dislike a comment without a token", async () => {
    const res = await request(app).put(
      `/api/comments/comment/${commentId1}/dislike`
    );

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to dislike a comment that is already disliked by the user", async () => {
    await request(app)
      .put(`/api/comments/comment/${commentId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser1}`); // First dislike

    const res = await request(app)
      .put(`/api/comments/comment/${commentId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser1}`); // Try to dislike again

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty(
      "message",
      "You have already disliked this comment"
    );
  });

  it("should fail to dislike a comment with an invalid or non-existent comment ID", async () => {
    const nonExistentCommentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/comments/comment/${nonExistentCommentId}/dislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Comment not found");
  });

  // 9. Undislike a Comment (PUT /comment/:commentId/undislike)

  it("should undislike a comment successfully with a valid token", async () => {
    await request(app)
      .put(`/api/comments/comment/${commentId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    const res = await request(app)
      .put(`/api/comments/comment/${commentId1}/undislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.dislikes).toBe(0);
  });

  it("should fail to undislike a comment without a token", async () => {
    const res = await request(app).put(
      `/api/comments/comment/${commentId1}/undislike`
    );

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to undislike a comment that hasn't been disliked by the user", async () => {
    const res = await request(app)
      .put(`/api/comments/comment/${commentId1}/undislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty(
      "message",
      "You haven't disliked this comment"
    );
  });

  it("should fail to undislike a comment with an invalid or non-existent comment ID", async () => {
    const nonExistentCommentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/comments/comment/${nonExistentCommentId}/undislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Comment not found");
  });
});
