const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const keys = require("../../config/keys");
const passport = require("passport");
const nodemailer = require("nodemailer")
const fs = require('fs');
const path = require('path');
const multer = require('multer');

let crypto;
try {
  crypto = require('crypto');
} catch (err) {
  console.log('crypto support is disabled!');
}

// Load input validation
const validateRegisterInput = require("../../validation/register");
const validateLoginInput = require("../../validation/login");

// Load Users model
const Volunteer = require("../../models/volunteer");
const Teacher = require("../../models/teacher");
const Token = require("../../models/verificationToken")

//use multer to store image file submitted
var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});

var upload = multer({ storage: storage });

//------------------------------------------------VOLUNTEER REGISTRATION/LOGIN/VERIFICATION ROUTES -------------------------------------------------------------------------------
// @route POST api/users/volunteer/register
// @desc Register user
// @access Public
router.post("/volunteer/register", (req, res) => {
  // Form validation

  const { errors, isValid } = validateRegisterInput(req.body);

  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }

  Volunteer.findOne({ email: req.body.email }).then(user => {
    if (user) {
      return res.status(400).json({ email: "Email already exists" });
    } else {
      const newUser = new Volunteer({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        whatsAppNumber: req.body.whatsAppNumber,
        alternateNumber: req.body.alternateNumber,
        teacherReferenceContact: req.body.teacherReferenceContact,
        teacherName: req.body.teacherName
      });

      // Hash password before saving in database
      bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(newUser.password, salt, (err, hash) => {
          if (err) throw err;
          newUser.password = hash;
          newUser
            .save()
            .then(user => res.json(user))
            .catch(err => console.log(err));
        });
      })
    }
  }).then((user) => {

      //create token for user mail verification
      var token = new Token ({
        _userId: user._id,
        token: crypto.randomBytes(16).toString('hex')
      });
      token.save((err) => {
        if(err){
          return res.status(500).send({msg:err.message});
        }

      //send mail (use SendGrid credentials to send mail to user)
      var transporter = nodemailer.createTransport({
        service: 'Sendgrid',
        auth: {
          user: keys.sendGrid_userName,
          pass: keys.sendGrid_Password
        }
      });
      var mailOptions = {
        from: 'dubeyagam@gmail.com',
        to: user.email,
        subject: 'Verify your email',
        text: 'Hello '+ req.body.name +',\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nThank You!\n'
      };
      transporter.sendMail(mailOptions, (err) => {
        if(err){
          return res.status(500).send({msg: 'Technical issue! Please click on resend to verify your email'})
        }
        return res.status(200).send('A verification email has been sent to ' + user.email + '. It will expire in one day. If you did not get an email click on resend');
        })
      });
    });
  });

// @route POST api/users/volunteer/login
// @desc Login user and return JWT token
// @access Public
router.post("/volunteer/login", (req, res) => {
  // Form validation

  const { errors, isValid } = validateLoginInput(req.body);

  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const email = req.body.email;
  const password = req.body.password;

  // Find user by email
  Volunteer.findOne({ email }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ emailnotfound: "Email not found" });
    }

    // Check password
    bcrypt.compare(password, user.password).then(isMatch => {
      if (isMatch) {
        // User matched
        // Create JWT Payload
        const payload = {
          id: user.id,
          name: user.name
        };

        // Sign token
        jwt.sign(
          payload,
          keys.secretOrKey,
          {
            expiresIn: 31556926 // 1 year in seconds
          },
          (err, token) => {
            res.json({
              success: true,
              token: "Bearer " + token
            });
          }
        );
      }
      else if(!user.isVerified){
        return res.status(401).send({msg:'Your Email has not been verified. Please click on resend'});
      }
       else {
        return res
          .status(400)
          .json({ passwordincorrect: "Password incorrect" });
      }
    });
  });
});

//@route GET api/users/volunteer/confirmation/:email/:token
//verify user email and turn the isVerified to true
router.get('/volunteer/confirmation/:email/:token', (req, res) => {
  //get params from url in our Token DB
  Token.findOne({token: req.params.token}, (err, token) => {
    //token not found i.e token expired
    if (!token){
      res.status(400).send({msg: 'Your link may have been expired. Please click on resend email'})
    }
    //if token found check valid user
    else {
      Volunteer.findOne({_id: token._userId, email: req.params.email}, (err, user) => {
        //no user found
        if (!user){
          return res.status(401).send({msg: "We're not able to find a valid user for this verification link"})
        }
        //user already verified
        else if(user.isVerified){
          return res.status(200).send({msg: "This account has already been verified"})
        }
        //else verify the user
        else {
          //change DB boolean to true
          user.isVerified = true;
          user.save((err) => {
            //error occured
            if(err){
              return res.status(500).send({msg: err.message})
            }
            //account verified
            else {
              return res.status(200).send({msg: 'Your account has been successfully verified'})
            }
          });
        }
      });
    }
  });
});

//@Route POST /api/users/volunteer/resendlink
//Resend the account verification link to user
router.get('/volunteer/resendlink', (req, res) => {

  Volunteer.findOne({ email: req.body.email }, (err, user) => {
    //no user in db
    if (!user){
      return res.status(400).send({msg: "We are unable to find the user with that email. Make sure your email is correct"})
    }
    //user is verified
    else if (user.isVerified){
      return res.status(200).send({msg: "This account is already been verified. Please log in."})
    }

    //send verification link again with new token
    else {
      //generate new token
      var token = new Token({
        _userId: user._id,
        token: crypto.randomBytes(16).toString('hex')
      });
      token.save((err) => {
        if(err){
          return res.status(500).send({msg: err.message})
        }

        //while saving need to send email
        //send mail with SendGrid
        var transporter = nodemailer.createTransport({ service: 'Sendgrid', auth: { user: keys.sendGrid_userName, pass: keys.sendGrid_Password }});
        var mailOptions = {
          from: 'dubeyagam@gmail.com',
          to: user.email,
          subject: 'Link to verify your AOL account',
          text: 'Hello '+ req.body.name +',\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nThank You!\n'
        };
        transporter.sendMail(mailOptions, (err) => {
          if(err){
            return res.status(500).send({msg: 'Technical issue! Please click on resend link to get new link on your mail'})
          }
          return res.status(200).send({msg: 'A verification link has been send to ' + user.email + '. It will expire in one day. If your did not receive a mail click on resend mail.'})
        });
      });
    }
  });
});

//------------------------------------------------------TEACHERS REGISTER/LOGIN/VERIFICATION ROUTES ------------------------------------------------------------------------------
// @route POST api/users/teacher/register
// @desc Register user
// @access Public
router.post("/teacher/register", upload.single('image'), (req, res) => {
  // Form validation

  const { errors, isValid } = validateRegisterInput(req.body);

  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }

  Teacher.findOne({ email: req.body.email }).then(user => {
    if (user) {
      return res.status(400).json({ email: "Email already exists" });
    } else {
      const newUser = new Teacher({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        whatsAppNumber: req.body.whatsAppNumber,
        alternateNumber: req.body.alternateNumber,
        teacherIdImage: {
          data: fs.readFileSync(path.join('../backend/uploads/' + req.file.filename)),
          contentType: 'image/png'
        },
        teacherIdNumber: req.body.teacherIdNumber,
        yourTeacherName: req.body.yourTeacherName,
        yourTeacherMobileNumber: req.body.yourTeacherMobileNumber
      });

      // Hash password before saving in database
      bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(newUser.password, salt, (err, hash) => {
          if (err) throw err;
          newUser.password = hash;
          newUser
            .save()
            .then(user => res.json(user))
            .catch(err => console.log(err));
        });
      });

      //create token for user mail verification
      var token = new Token ({
        _userId: user._id,
        token: crypto.randomBytes(16).toString('hex')
      });
      token.save((err) => {
        if(err){
          return res.status(500).send({msg:err.message});
        }

      //send mail (use SendGrid credentials to send mail to user)
      var transporter = nodemailer.createTransport({
        service: 'Sendgrid',
        auth: {
          user: keys.sendGrid_userName,
          pass: keys.sendGrid_Password
        }
      });
      var mailOptions = {
        from: 'dubeyagam@gmail.com',
        to: user.email,
        subject: 'Verify your email',
        text: 'Hello '+ req.body.name +',\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nThank You!\n'
      };
      transporter.sendMail(mailOptions, (err) => {
        if(err){
          return res.status(500).send({msg: 'Technical issue! Please click on resend to verify your email'})
        }
        return res.status(200).send('A verification email has been sent to ' + user.email + '. It will expire in one day. If you did not get an email click on resend');
      });
    });
  }
  });
});

// @route POST api/users/teacher/login
// @desc Login user and return JWT token
// @access Public
router.post("/teacher/login", (req, res) => {
  // Form validation

  const { errors, isValid } = validateLoginInput(req.body);

  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const email = req.body.email;
  const password = req.body.password;

  // Find user by email
  Teacher.findOne({ email }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ emailnotfound: "Email not found" });
    }

    // Check password
    bcrypt.compare(password, user.password).then(isMatch => {
      if (isMatch) {
        // User matched
        // Create JWT Payload
        const payload = {
          id: user.id,
          name: user.name
        };

        // Sign token
        jwt.sign(
          payload,
          keys.secretOrKey,
          {
            expiresIn: 31556926 // 1 year in seconds
          },
          (err, token) => {
            res.json({
              success: true,
              token: "Bearer " + token
            });
          }
        );
      }
      else if(!user.isVerified){
        return res.status(401).send({msg:'Your Email has not been verified. Please click on resend'});
      }
       else {
        return res
          .status(400)
          .json({ passwordincorrect: "Password incorrect" });
      }
    });
  });
});

//@route GET api/users/teacher/confirmation/:email/:token
//verify user email and turn the isVerified to true
router.get('/teacher/confirmation/:email/:token', (req, res) => {
  //get params from url in our Token DB
  Token.findOne({token: req.params.token}, (err, token) => {
    //token not found i.e token expired
    if (!token){
      res.status(400).send({msg: 'Your link may have been expired. Please click on resend email'})
    }
    //if token found check valid user
    else {
      Teacher.findOne({_id: token._userId, email: req.params.email}, (err, user) => {
        //no user found
        if (!user){
          return res.status(401).send({msg: "We're not able to find a valid user for this verification link"})
        }
        //user already verified
        else if(user.isVerified){
          return res.status(200).send({msg: "This account has already been verified"})
        }
        //else verify the user
        else {
          //change DB boolean to true
          user.isVerified = true;
          user.save((err) => {
            //error occured
            if(err){
              return res.status(500).send({msg: err.message})
            }
            //account verified
            else {
              return res.status(200).send({msg: 'Your account has been successfully verified'})
            }
          });
        }
      });
    }
  });
});

//@Route POST /api/users/teacher/resendlink
//Resend the account verification link to user
router.get('/teacher/resendlink', (req, res) => {

  Teacher.findOne({ email: req.body.email }, (err, user) => {
    //no user in db
    if (!user){
      return res.status(400).send({msg: "We are unable to find the user with that email. Make sure your email is correct"})
    }
    //user is verified
    else if (user.isVerified){
      return res.status(200).send({msg: "This account is already been verified. Please log in."})
    }

    //send verification link again with new token
    else {
      //generate new token
      var token = new Token({
        _userId: user._id,
        token: crypto.randomBytes(16).toString('hex')
      });
      token.save((err) => {
        if(err){
          return res.status(500).send({msg: err.message})
        }

        //while saving need to send email
        //send mail with SendGrid
        var transporter = nodemailer.createTransport({ service: 'Sendgrid', auth: { user: keys.sendGrid_userName, pass: keys.sendGrid_Password }});
        var mailOptions = {
          from: 'dubeyagam@gmail.com',
          to: user.email,
          subject: 'Link to verify your AOL account',
          text: 'Hello '+ req.body.name +',\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nThank You!\n'
        };
        transporter.sendMail(mailOptions, (err) => {
          if(err){
            return res.status(500).send({msg: 'Technical issue! Please click on resend link to get new link on your mail'})
          }
          return res.status(200).send({msg: 'A verification link has been send to ' + user.email + '. It will expire in one day. If your did not receive a mail click on resend mail.'})
        });
      });
    }
  });
});

module.exports = router;
