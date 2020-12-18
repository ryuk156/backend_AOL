Backend for AOL

No Environment
BUILD
1) Volunteer endpoints: -> POST registertration volunteer- https://localhost:5000/api/users/volunteer/register -> Form data for volunteer registration: { name: req.body.name, email: req.body.email, password: req.body.password, whatsAppNumber: req.body.whatsAppNumber, alternateNumber: req.body.alternateNumber, teacherReferenceContact: req.body.teacherReferenceContact, teacherName: req.body.teacherName } -> POST volunteer login: endpoint: http://localhost:5000/api/users/volunteer/login -> Login form data:{ email = req.body.email, password = req.body.password }

1) Teacher endpoints: -> POST teacher registration: http://localhost:5000/api/users/teacher/register -> Teacher registration form data: { name: req.body.name, email: req.body.email, password: req.body.password, whatsAppNumber: req.body.whatsAppNumber, alternateNumber: req.body.alternateNumber, teacherIdImage: { data: fs.readFileSync(path.join('../backend/uploads/' + req.file.filename)), contentType: 'image/png' }, teacherIdNumber: req.body.teacherIdNumber, yourTeacherName: req.body.yourTeacherName, yourTeacherMobileNumber: req.body.yourTeacherMobileNumber } -> POST teacher login: http:localhost:5000/api/users/teacher/login -> teacher login post data: email, password
