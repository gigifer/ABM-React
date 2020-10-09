const Usuario = require('../models/usuario');
const bcryptjs = require('bcrypt');

// Resolvers
const resolvers = {
    Query: {
        obtenerCurso: () => 'Hola'
    },
    Mutation: {
        nuevoUsuario:async (_, {input}) => {

            const { email, password } = input;

            // revisar si el usuario ya está registrado
            const existeUsuario = await Usuario.findOne({email});
            if (existeUsuario) {
                throw new Error('El usuario ya está registrado');
            }

            // hashear su password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            try {
                // guardarlo en la base de datos
                const usuario = new Usuario(input);
                usuario.save(); //guardarlo
                return usuario;
            } catch (error) {
                console.log(error);
            }
            
        }
    } 
}

module.exports = resolvers;
